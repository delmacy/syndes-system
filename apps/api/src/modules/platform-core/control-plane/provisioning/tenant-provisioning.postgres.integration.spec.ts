import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Pool } from 'pg';
import {
  quotePgIdentifier,
  tenantDatabaseName,
  tenantDatabaseRoleName,
} from './provisioning-contracts';
import {
  TenantProvisioningError,
  TenantProvisioningService,
  type TenantProvisioningLogger,
} from './tenant-provisioning.service';
import type {
  TenantDatabaseCredential,
  TenantSecretStore,
} from './tenant-secret-store';

const TENANT_INTEGRATION_TIMEOUT_MS = 120000;

const describeIntegration = process.env.CONTROL_PLANE_DATABASE_URL
  ? describe
  : describe.skip;

/**
 * CRM-02 integration proof over disposable PostgreSQL 16:
 * repeated calls, concurrency, intermediate failure/recovery, sanitized
 * failures, external migration application, and least-privilege isolation.
 * Runs whenever a disposable CONTROL_PLANE_DATABASE_URL is available (CI),
 * and is skipped otherwise (the local workflow has no database bound).
 */
describeIntegration(
  'CRM-02 tenant provisioning (disposable PostgreSQL)',
  () => {
    let adminPool: Pool;
    let secretStore: InMemoryTenantSecretStore;
    let logs: { level: string; message: string }[];
    const disposableNames = {
      databases: [] as string[],
      roles: [] as string[],
    };

    jest.setTimeout(TENANT_INTEGRATION_TIMEOUT_MS);

    const projectDir = process.cwd();
    const cpApplyScript = path.join(
      projectDir,
      'scripts',
      'apply-control-plane-migrations.mjs',
    );
    const tenantApplyScript = path.join(
      projectDir,
      'scripts',
      'apply-tenant-migrations.mjs',
    );

    function applyControlPlaneMigrations(): void {
      execFileSync(process.execPath, [cpApplyScript], {
        env: process.env,
        stdio: 'inherit',
        cwd: projectDir,
      });
    }

    function runTenantMigrationsScript(databaseName: string): void {
      execFileSync(process.execPath, [tenantApplyScript], {
        env: { ...process.env, TENANT_DATABASE_URL: tenantUrl(databaseName) },
        stdio: 'inherit',
        cwd: projectDir,
      });
    }

    function tenantUrl(databaseName: string): string {
      const source = new URL(process.env.CONTROL_PLANE_DATABASE_URL);
      source.pathname = `/${databaseName}`;
      return source.toString();
    }

    class RecordingLogger implements TenantProvisioningLogger {
      info(message: string) {
        logs.push({ level: 'info', message });
      }
      warn(message: string) {
        logs.push({ level: 'warn', message });
      }
      error(message: string) {
        logs.push({ level: 'error', message });
      }
    }

    class InMemoryTenantSecretStore implements TenantSecretStore {
      readonly records = new Map<string, TenantDatabaseCredential>();

      saveTenantDatabaseCredential(
        tenantId: string,
        credential: TenantDatabaseCredential,
      ): Promise<void> {
        this.records.set(tenantId, credential);
        return Promise.resolve();
      }
    }

    function buildService(): TenantProvisioningService {
      return new TenantProvisioningService(adminPool, secretStore, {
        adminPool,
        adminConnectionString: process.env.CONTROL_PLANE_DATABASE_URL,
        logger: new RecordingLogger(),
      });
    }

    async function insertDisposableTenant(
      displayName: string,
      id = randomUUID(),
    ): Promise<{ id: string; databaseName: string; roleName: string }> {
      const databaseName = tenantDatabaseName(id);
      await adminPool.query(
        `INSERT INTO tenants (id, display_name, database_name, provisioning_state)
       VALUES ($1, $2, $3, 'pending')`,
        [id, displayName, databaseName],
      );
      disposableNames.databases.push(databaseName);
      disposableNames.roles.push(tenantDatabaseRoleName(id));
      return { id, databaseName, roleName: tenantDatabaseRoleName(id) };
    }

    beforeAll(() => {
      adminPool = new Pool({
        connectionString: process.env.CONTROL_PLANE_DATABASE_URL,
      });
      secretStore = new InMemoryTenantSecretStore();
      logs = [];
      applyControlPlaneMigrations();
    }, TENANT_INTEGRATION_TIMEOUT_MS);

    afterEach(() => {
      logs = [];
    });

    afterAll(async () => {
      for (const databaseName of disposableNames.databases) {
        await adminPool.query(
          `DROP DATABASE IF EXISTS ${quotePgIdentifier(databaseName)} WITH (FORCE)`,
        );
      }
      for (const roleName of disposableNames.roles) {
        await adminPool.query(
          `DROP ROLE IF EXISTS ${quotePgIdentifier(roleName)}`,
        );
      }
      await adminPool.end();
    }, TENANT_INTEGRATION_TIMEOUT_MS);

    it('provisions a tenant database and least-privilege role end to end', async () => {
      const tenant = await insertDisposableTenant('Idempotency tenant');
      const service = buildService();

      const outcome = await service.provision(tenant.id);

      expect(outcome.alreadyReady).toBe(false);
      expect(outcome.databaseName).toBe(tenant.databaseName);
      const registry = await adminPool.query<{ provisioning_state: string }>(
        `SELECT provisioning_state FROM tenants WHERE id = $1`,
        [tenant.id],
      );
      expect(registry.rows[0]?.provisioning_state).toBe('ready');
      const attempt = await adminPool.query<{
        stage: string;
        failure_code: string | null;
        attempt: number;
      }>(
        `SELECT stage, failure_code, attempt FROM tenant_provisioning WHERE tenant_id = $1`,
        [tenant.id],
      );
      expect(attempt.rows[0]).toMatchObject({
        stage: 'ready',
        failure_code: null,
      });

      const databases = await adminPool.query<{ datname: string }>(
        `SELECT datname FROM pg_database WHERE datname = $1`,
        [tenant.databaseName],
      );
      expect(databases.rowCount).toBe(1);
      const roles = await adminPool.query<{
        rolsuper: boolean;
        rolcreatedb: boolean;
        rolcreaterole: boolean;
        rolcanlogin: boolean;
      }>(
        `SELECT rolsuper, rolcreatedb, rolcreaterole, rolcanlogin FROM pg_roles WHERE rolname = $1`,
        [tenant.roleName],
      );
      expect(roles.rows[0]).toMatchObject({
        rolcanlogin: true,
        rolsuper: false,
        rolcreatedb: false,
        rolcreaterole: false,
      });

      const credential = secretStore.records.get(tenant.id);
      expect(credential?.databaseName).toBe(tenant.databaseName);
      expect(credential?.username).toBe(tenant.roleName);
    });

    it('repeated ready provision is an idempotent no-op and migrations stay durable', async () => {
      const tenant = await insertDisposableTenant('Repeat tenant');
      const service = buildService();
      await service.provision(tenant.id);

      const journalBefore = await tenantJournalCount(tenant.databaseName);
      const repeated = await service.provision(tenant.id);
      expect(repeated.alreadyReady).toBe(true);

      const journalAfter = await tenantJournalCount(tenant.databaseName);
      expect(journalAfter).toBe(journalBefore);
      const roleRows = await adminPool.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM pg_roles WHERE rolname = $1`,
        [tenant.roleName],
      );
      expect(roleRows.rows[0]?.count).toBe(1);
    });

    it('serializes concurrent provisioning attempts for one tenant', async () => {
      const tenant = await insertDisposableTenant('Concurrent tenant');
      const service = buildService();

      const outcomes = await Promise.all([
        service.provision(tenant.id),
        service.provision(tenant.id),
        service.provision(tenant.id),
        service.provision(tenant.id),
      ]);

      expect(outcomes.filter((outcome) => !outcome.alreadyReady)).toHaveLength(
        1,
      );
      expect(outcomes.filter((outcome) => outcome.alreadyReady)).toHaveLength(
        3,
      );
      const roles = await adminPool.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM pg_roles WHERE rolname = $1`,
        [tenant.roleName],
      );
      expect(roles.rows[0]?.count).toBe(1);
      const databases = await adminPool.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM pg_database WHERE datname = $1`,
        [tenant.databaseName],
      );
      expect(databases.rows[0]?.count).toBe(1);
    });

    it('recovers safely from an intermediate failure inside the migration stage', async () => {
      const tenant = await insertDisposableTenant('Recovery tenant');
      const failingService = new TenantProvisioningService(
        adminPool,
        secretStore,
        {
          adminPool,
          adminConnectionString: process.env.CONTROL_PLANE_DATABASE_URL,
          logger: new RecordingLogger(),
          migrationsRunner: () =>
            Promise.reject(new Error('injected migration step failure')),
        },
      );
      await expect(failingService.provision(tenant.id)).rejects.toThrow(
        new TenantProvisioningError('migrations', 'migration_failed'),
      );
      const failed = await adminPool.query<{ provisioning_state: string }>(
        `SELECT provisioning_state FROM tenants WHERE id = $1`,
        [tenant.id],
      );
      expect(failed.rows[0]?.provisioning_state).toBe('failed');
      const failedAttempt = await adminPool.query<{
        stage: string;
        failure_code: string | null;
        attempt: number;
        finished_at: Date | null;
      }>(
        `SELECT stage, failure_code, attempt, finished_at FROM tenant_provisioning WHERE tenant_id = $1`,
        [tenant.id],
      );
      expect(failedAttempt.rows[0]).toMatchObject({
        stage: 'migrations',
        failure_code: 'migration_failed',
      });
      expect(failedAttempt.rows[0]?.finished_at).toBeInstanceOf(Date);

      // Retry from `failed` completes; no duplicated database or role is
      // created and the partial state is resumed.
      const recovery = await buildService().provision(tenant.id);
      expect(recovery.alreadyReady).toBe(false);
      expect(recovery.state).toBe('ready');
      const attemptRows = await adminPool.query<{
        stage: string;
        failure_code: string | null;
        attempt: number;
      }>(
        `SELECT attempt, stage, failure_code FROM tenant_provisioning WHERE tenant_id = $1`,
        [tenant.id],
      );
      expect(attemptRows.rows[0]).toMatchObject({
        stage: 'ready',
        failure_code: null,
      });
      const databases = await adminPool.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM pg_database WHERE datname = $1`,
        [tenant.databaseName],
      );
      expect(databases.rows[0]?.count).toBe(1);
      const roles = await adminPool.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM pg_roles WHERE rolname = $1`,
        [tenant.roleName],
      );
      expect(roles.rows[0]?.count).toBe(1);
      const tenantTables = await tenantTableSet(tenant.databaseName);
      expect(tenantTables).toEqual(['tenant_baseline_info']);
    });

    it('keeps credentials and connection strings out of logs and thrown errors', async () => {
      const tenant = await insertDisposableTenant('Sanitization tenant');
      const poisonStore: TenantSecretStore = {
        saveTenantDatabaseCredential(): Promise<void> {
          return Promise.reject(
            new Error(
              'store-unreachable admin:topsecret@secretstore.internal:8443 tok_val',
            ),
          );
        },
      };
      const poisoned = new TenantProvisioningService(adminPool, poisonStore, {
        adminPool,
        adminConnectionString: process.env.CONTROL_PLANE_DATABASE_URL,
        logger: new RecordingLogger(),
      });

      const thrownMessage = await poisoned
        .provision(tenant.id)
        .then(() => 'unexpected-success')
        .catch((error: unknown) =>
          error instanceof Error ? error.message : 'non-error-throw',
        );

      expect(thrownMessage).toBe(
        'Tenant provisioning failed at stage credential (credential_store_failed).',
      );
      for (const entry of [
        ...logs.map((log) => `${log.level}: ${log.message}`),
        thrownMessage,
      ]) {
        expect(entry).not.toContain('topsecret');
        expect(entry).not.toContain('tok_val');
        expect(entry).not.toContain('secretstore.internal');
        expect(entry).not.toContain('postgresql://');
      }
    });

    it('tenant migrations apply outside the API runtime through the release script, repeatedly', async () => {
      const tenant = await insertDisposableTenant('Script tenant');
      const service = buildService();
      await service.provision(tenant.id);

      const first = await tenantJournalCount(tenant.databaseName);
      runTenantMigrationsScript(tenant.databaseName);
      const second = await tenantJournalCount(tenant.databaseName);
      expect(second).toBe(first);
    });

    it('keeps tenant roles isolated to their own databases', async () => {
      const first = await insertDisposableTenant('Isolation tenant A');
      const second = await insertDisposableTenant('Isolation tenant B');
      const service = buildService();
      await service.provision(first.id);
      await service.provision(second.id);

      const firstCredential = secretStore.records.get(first.id)!;
      expect(firstCredential.password).toMatch(/^[A-Za-z0-9_-]{32}$/);
      const source = new URL(process.env.CONTROL_PLANE_DATABASE_URL);

      // The role reaches its own database only.
      const ownPool = new Pool({
        host: source.hostname,
        port: Number(source.port || 5432),
        database: first.databaseName,
        user: firstCredential.username,
        password: firstCredential.password,
      });
      try {
        const session = await ownPool.query<{ current_user: string }>(
          'SELECT current_user',
        );
        expect(session.rows[0]?.current_user).toBe(first.roleName);
      } finally {
        await ownPool.end();
      }

      // ...and never another tenant's database.
      const crossPool = new Pool({
        host: source.hostname,
        port: Number(source.port || 5432),
        database: second.databaseName,
        user: firstCredential.username,
        password: firstCredential.password,
      });
      try {
        let reachable = true;
        try {
          await crossPool.query('SELECT 1');
        } catch {
          reachable = false;
        }
        expect(reachable).toBe(false);
      } finally {
        await crossPool.end();
      }
    });

    async function tenantJournalCount(databaseName: string): Promise<number> {
      const tenantPool = new Pool({
        connectionString: tenantUrl(databaseName),
      });
      try {
        const journal = await tenantPool.query<{ count: number }>(
          `SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`,
        );
        return journal.rows[0]?.count ?? -1;
      } finally {
        await tenantPool.end();
      }
    }

    async function tenantTableSet(databaseName: string): Promise<string[]> {
      const tenantPool = new Pool({
        connectionString: tenantUrl(databaseName),
      });
      try {
        const tables = await tenantPool.query<{ table_name: string }>(
          `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
         ORDER BY table_name`,
        );
        return tables.rows.map((row) => row.table_name);
      } finally {
        await tenantPool.end();
      }
    }
  },
);
