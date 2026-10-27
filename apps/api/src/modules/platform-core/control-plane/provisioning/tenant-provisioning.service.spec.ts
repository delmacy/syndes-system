import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import {
  tenantDatabaseName,
  tenantDatabaseRoleName,
} from './provisioning-contracts';
import {
  TenantDatabaseNameMismatchError,
  TenantProvisioningError,
  TenantProvisioningNotFoundError,
  TenantProvisioningService,
  type ProvisionTenantOutcome,
} from './tenant-provisioning.service';
import type { TenantSecretStore } from './tenant-secret-store';

/**
 * In-memory PostgreSQL substitute covering only the statements the
 * provisioning service executes, so unit tests can prove state machine,
 * claim/lock, idempotency, failure persistence, and log sanitization
 * without a database. Real PostgreSQL behavior is proven separately by the
 * disposable integration tests.
 */

interface FakeLogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
}

class FakePg {
  tenants = new Map<
    string,
    { database_name: string; provisioning_state: string }
  >();
  provisioningRows = new Map<
    string,
    { attempt: number; stage: string; failure_code: string | null }
  >();
  createdDatabases: string[] = [];
  createdRoles: string[] = [];
  tenantGrantSql: string[] = [];
  migrationRuns: string[] = [];
  controlPlaneSql: string[] = [];
  lockChain = new Map<string, Promise<void>>();
  activeLockRelease = new Map<string, () => void>();

  addTenant(id: string, state = 'pending') {
    this.tenants.set(id, {
      database_name: tenantDatabaseName(id),
      provisioning_state: state,
    });
  }

  /** Per-key FIFO advisory lock with an explicit holder release. */
  async acquireLock(key: string): Promise<void> {
    let release: () => void = () => undefined;
    const ticket = new Promise<void>((resolve) => {
      release = resolve;
    });
    const chain = this.lockChain.get(key) ?? Promise.resolve();
    this.lockChain.set(
      key,
      chain.then(() => {
        this.activeLockRelease.set(key, release);
        return ticket;
      }),
    );
    await chain;
  }

  releaseLock(key: string): void {
    const release = this.activeLockRelease.get(key);
    this.activeLockRelease.delete(key);
    release?.();
  }

  async query(
    sql: string,
    values: readonly unknown[] = [],
  ): Promise<{
    rows: Record<string, unknown>[];
    rowCount: number;
  }> {
    this.controlPlaneSql.push(sql);
    return this.interpret(sql, values);
  }

  interpret(
    sql: string,
    values: readonly unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number }> {
    if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(sql.trim())) {
      return Promise.resolve({ rows: [], rowCount: 0 });
    }
    if (/SELECT id, database_name, provisioning_state FROM tenants/.test(sql)) {
      const tenant = this.tenants.get(String(values[0]));
      return tenant
        ? {
            rows: [
              {
                id: values[0],
                database_name: tenant.database_name,
                provisioning_state: tenant.provisioning_state,
              },
            ],
            rowCount: 1,
          }
        : { rows: [], rowCount: 0 };
    }
    if (
      /SELECT attempt, stage, failure_code FROM tenant_provisioning/.test(sql)
    ) {
      const row = this.provisioningRows.get(String(values[0]));
      return row
        ? {
            rows: [
              {
                attempt: row.attempt,
                stage: row.stage,
                failure_code: row.failure_code,
              },
            ],
            rowCount: 1,
          }
        : { rows: [], rowCount: 0 };
    }
    if (/UPDATE tenants\s+SET provisioning_state = '(\w+)'/.test(sql)) {
      const targetState = /'(\w+)'/.exec(sql)?.[1] ?? '';
      const tenant = this.tenants.get(String(values[0]));
      if (!tenant) {
        return { rows: [], rowCount: 0 };
      }
      // Conditional claim: the expected previous state is bound at $2.
      const expectedState =
        values.length > 1 ? String(values[1]) : 'in_progress';
      if (tenant.provisioning_state !== expectedState) {
        return { rows: [], rowCount: 0 };
      }
      tenant.provisioning_state = targetState;
      return { rows: [], rowCount: 1 };
    }
    if (
      /INSERT INTO tenant_provisioning/.test(sql) &&
      /ON CONFLICT/.test(sql)
    ) {
      const id = String(values[0]);
      const current = this.provisioningRows.get(id);
      this.provisioningRows.set(id, {
        attempt: (current?.attempt ?? 0) + 1,
        stage: 'claimed',
        failure_code: null,
      });
      return { rows: [], rowCount: 1 };
    }
    if (/UPDATE\s+tenant_provisioning\s+SET\s+stage\s*=\s*\$2/.test(sql)) {
      const id = String(values[0]);
      const current = this.provisioningRows.get(id) ?? {
        attempt: 1,
        stage: 'claimed',
        failure_code: null,
      };
      this.provisioningRows.set(id, {
        ...current,
        stage: String(values[1]),
        failure_code: (values[2] ?? null) as string | null,
      });
      return { rows: [], rowCount: 1 };
    }
    if (/UPDATE\s+tenant_provisioning\s+SET\s+stage\s*=\s*'ready'/.test(sql)) {
      const id = String(values[0]);
      const current = this.provisioningRows.get(id) ?? {
        attempt: 1,
        stage: 'claimed',
        failure_code: null,
      };
      this.provisioningRows.set(id, {
        ...current,
        stage: 'ready',
        failure_code: null,
      });
      return { rows: [], rowCount: 1 };
    }
    if (/INSERT INTO audit_events/.test(sql)) {
      return { rows: [], rowCount: 1 };
    }
    if (/SELECT pg_advisory_(un)?lock\(\$1\)/.test(sql)) {
      return { rows: [{ key: values[0] }], rowCount: 1 };
    }
    if (/SELECT 1 AS ok FROM pg_database/.test(sql)) {
      const exists = this.createdDatabases.includes(String(values[0]));
      return exists
        ? { rows: [{ ok: 1 }], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }
    if (/SELECT 1 AS ok FROM pg_roles/.test(sql)) {
      const exists = this.createdRoles.includes(String(values[0]));
      return exists
        ? { rows: [{ ok: 1 }], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }
    if (/CREATE DATABASE/.test(sql)) {
      const name = /"([^"]+)"/.exec(sql)?.[1] ?? '';
      this.createdDatabases.push(name);
      return { rows: [], rowCount: 1 };
    }
    if (/CREATE ROLE/.test(sql)) {
      const name = /"([^"]+)"/.exec(sql)?.[1] ?? '';
      this.createdRoles.push(name);
      return { rows: [], rowCount: 1 };
    }
    if (/ALTER ROLE/.test(sql)) {
      return { rows: [], rowCount: 1 };
    }
    throw new Error('FakePg does not understand this statement.');
  }

  tenantQuery(sql: string): {
    rows: Record<string, unknown>[];
    rowCount: number;
  } {
    this.tenantGrantSql.push(sql);
    return { rows: [], rowCount: 1 };
  }
}

function makeControlPlaneClient(fake: FakePg): PoolClient {
  const client = {
    async query(sql: string, values: readonly unknown[] = []) {
      if (/SELECT pg_advisory_lock\(\$1\)/.test(sql)) {
        await fake.acquireLock(String(values[0]));
        return { rows: [], rowCount: 1 };
      }
      if (/SELECT pg_advisory_unlock\(\$1\)/.test(sql)) {
        fake.releaseLock(String(values[0]));
        return { rows: [], rowCount: 1 };
      }
      return fake.query(sql, values);
    },
    release(): void {
      return undefined;
    },
  } as unknown as PoolClient;
  return client;
}

function makeControlPlanePool(fake: FakePg): Pool {
  return {
    connect: () => makeControlPlaneClient(fake),
    query: (sql: string, values?: readonly unknown[]) =>
      fake.query(sql, values ?? []),
  } as unknown as Pool;
}

function makeTenantAdminPool(
  fake: FakePg,
  databaseName: string,
  migrations: { folder?: string; fail?: boolean },
): Pool {
  return {
    connect: () => {
      const client = {
        query(sql: string) {
          fake.tenantGrantSql.push(sql);
          return Promise.resolve({ rows: [], rowCount: 1 });
        },
        release(): void {
          return undefined;
        },
      } as unknown as PoolClient;
      return Promise.resolve(client);
    },
    query: (sql: string) => {
      fake.tenantGrantSql.push(sql);
      void databaseName;
      void migrations.folder;
      return Promise.resolve({ rows: [], rowCount: 1 });
    },
    end: () => Promise.resolve(),
  } as unknown as Pool;
}

type FakeLoggerEntries = FakeLogEntry[];

function recordingLogger(entries: FakeLoggerEntries) {
  return {
    info: (message: string) => entries.push({ level: 'info', message }),
    warn: (message: string) => entries.push({ level: 'warn', message }),
    error: (message: string) => entries.push({ level: 'error', message }),
  };
}

type SecretStoreBehavior = {
  saved: { tenantId: string; username: string }[];
};

function okSecretStore(recorder: SecretStoreBehavior): TenantSecretStore {
  return {
    saveTenantDatabaseCredential(tenantId, credential) {
      recorder.saved.push({ tenantId, username: credential.username });
      return Promise.resolve();
    },
  };
}

function failingSecretStore(message: string): TenantSecretStore {
  return {
    saveTenantDatabaseCredential(): Promise<void> {
      return Promise.reject(new Error(message));
    },
  };
}

function serviceFor(
  fake: FakePg,
  options: {
    logger: FakeLoggerEntries;
    migrationsRunner: (
      tenantPool: Pool,
      migrationsFolder?: string,
    ) => Promise<void>;
  },
  secretStore: TenantSecretStore,
): TenantProvisioningService {
  return new TenantProvisioningService(
    makeControlPlanePool(fake),
    secretStore,
    {
      adminPool: makeControlPlanePool(fake),
      adminConnectionString: 'postgresql://db.internal:5432/control_plane',
      logger: recordingLogger(options.logger),
      migrationsRunner: options.migrationsRunner,
      tenantAdminPoolFactory: (databaseName: string) =>
        makeTenantAdminPool(fake, databaseName, {}),
    },
  );
}

describe('CRM-02 tenant provisioning service (unit)', () => {
  let fake: FakePg;
  let secretStoreBehavior: SecretStoreBehavior;
  let logs: FakeLoggerEntries;
  let migrationsRunnerCalls: number;
  const stubMigrationsRunner = () => {
    migrationsRunnerCalls += 1;
    return Promise.resolve();
  };

  beforeEach(() => {
    fake = new FakePg();
    secretStoreBehavior = { saved: [] };
    logs = [];
    migrationsRunnerCalls = 0;
  });

  function buildService(secretStore: TenantSecretStore) {
    return serviceFor(
      fake,
      { logger: logs, migrationsRunner: stubMigrationsRunner },
      secretStore,
    );
  }

  it('returns an idempotent no-op for a ready tenant without touching resources', async () => {
    const tenantId = randomUUID();
    fake.addTenant(tenantId, 'ready');
    const service = buildService(okSecretStore(secretStoreBehavior));

    const outcome = await service.provision(tenantId);

    expect(outcome).toEqual<ProvisionTenantOutcome>({
      tenantId,
      databaseName: tenantDatabaseName(tenantId),
      state: 'ready',
      alreadyReady: true,
    });
    expect(fake.createdDatabases).toEqual([]);
    expect(fake.createdRoles).toEqual([]);
    expect(secretStoreBehavior.saved).toEqual([]);
    expect(migrationsRunnerCalls).toBe(0);
    expect(logs.some((entry) => entry.level === 'error')).toBe(false);
  });

  it('rejects values that are not permanent UUIDs before any SQL runs', async () => {
    const service = buildService(okSecretStore(secretStoreBehavior));
    await expect(service.provision('db-name-from-request')).rejects.toThrow(
      TenantProvisioningNotFoundError,
    );
    expect(fake.controlPlaneSql).toEqual([]);
  });

  it('reports tenants that do not exist', async () => {
    const service = buildService(okSecretStore(secretStoreBehavior));
    await expect(service.provision(randomUUID())).rejects.toThrow(
      TenantProvisioningNotFoundError,
    );
  });

  it('guards against registry database references that were not UUID-derived', async () => {
    const tenantId = randomUUID();
    fake.addTenant(tenantId);
    const tenant = fake.tenants.get(tenantId);
    if (tenant) {
      tenant.database_name = 'display-name-derived-db';
    }
    const service = buildService(okSecretStore(secretStoreBehavior));
    await expect(service.provision(tenantId)).rejects.toThrow(
      TenantDatabaseNameMismatchError,
    );
    expect(fake.createdDatabases).toEqual([]);
  });

  it('provisions a pending tenant end to end and marks it ready', async () => {
    const tenantId = randomUUID();
    const expectedDatabase = tenantDatabaseName(tenantId);
    const expectedRole = tenantDatabaseRoleName(tenantId);
    fake.addTenant(tenantId);
    const service = buildService(okSecretStore(secretStoreBehavior));

    const outcome = await service.provision(tenantId);

    expect(outcome.alreadyReady).toBe(false);
    expect(outcome.state).toBe('ready');
    expect(fake.createdDatabases).toEqual([expectedDatabase]);
    expect(fake.createdRoles).toEqual([expectedRole]);
    expect(secretStoreBehavior.saved).toEqual([
      { tenantId, username: expectedRole },
    ]);
    expect(migrationsRunnerCalls).toBe(1);
    const tenant = fake.tenants.get(tenantId);
    expect(tenant?.provisioning_state).toBe('ready');
    expect(fake.provisioningRows.get(tenantId)).toMatchObject({
      stage: 'ready',
      attempt: 1,
      failure_code: null,
    });
    // The registry state flow stays inside the CRM-00 machine.
    const stateChanges = fake.controlPlaneSql.filter((sql) =>
      /UPDATE tenants/.test(sql),
    ).length;

    expect(stateChanges).toBeGreaterThan(0);
  });

  it('records a sanitized failure when the secret store is unavailable and allows a safe retry', async () => {
    const tenantId = randomUUID();
    fake.addTenant(tenantId);
    const failing = buildService(
      failingSecretStore('# exposed-credential-refused 127.0.0.1:9873'),
    );

    const thrownMessage = await failing
      .provision(tenantId)
      .then(() => 'unexpected-success')
      .catch((error: unknown) =>
        error instanceof Error ? error.message : 'non-error-throw',
      );
    expect(thrownMessage).toBe(
      'Tenant provisioning failed at stage credential (credential_store_failed).',
    );
    expect(thrownMessage).not.toContain('exposed-credential-refused');

    // Canonical state goes to failed; partial database state stays durable.
    expect(fake.tenants.get(tenantId)?.provisioning_state).toBe('failed');
    expect(fake.provisioningRows.get(tenantId)).toMatchObject({
      stage: 'credential',
      failure_code: 'credential_store_failed',
      attempt: 1,
    });
    expect(fake.createdDatabases).toEqual([tenantDatabaseName(tenantId)]);
    expect(fake.createdRoles).toEqual([]);
    for (const entry of logs) {
      expect(entry.message).not.toContain('exposed-credential-refused');
      expect(entry.message).not.toContain('127.0.0.1:9873');
    }

    // Retry from failed is allowed and completes the provisioning.
    const retry = await buildService(
      okSecretStore(secretStoreBehavior),
    ).provision(tenantId);
    expect(retry.alreadyReady).toBe(false);
    expect(retry.state).toBe('ready');
    expect(fake.tenants.get(tenantId)?.provisioning_state).toBe('ready');
    expect(fake.provisioningRows.get(tenantId)).toMatchObject({
      attempt: 2,
      stage: 'ready',
      failure_code: null,
    });
    expect(fake.createdDatabases).toHaveLength(1);
    expect(fake.createdRoles).toHaveLength(1);
  });

  it('records a sanitized migrations failure and retries without duplicating resources', async () => {
    const tenantId = randomUUID();
    fake.addTenant(tenantId);
    const healthyStore = okSecretStore(secretStoreBehavior);
    let failMigrations = true;

    const first = serviceFor(
      fake,
      {
        logger: logs,
        migrationsRunner: () => {
          migrationsRunnerCalls += 1;
          return failMigrations
            ? Promise.reject(
                new Error('relation "tenant_baseline_info" already exists'),
              )
            : Promise.resolve();
        },
      },
      healthyStore,
    );
    await expect(first.provision(tenantId)).rejects.toThrow(
      new TenantProvisioningError('migrations', 'migration_failed'),
    );
    expect(fake.tenants.get(tenantId)?.provisioning_state).toBe('failed');
    expect(fake.provisioningRows.get(tenantId)).toMatchObject({
      stage: 'migrations',
      failure_code: 'migration_failed',
    });
    for (const entry of logs) {
      expect(entry.message).not.toContain('tenant_baseline_info');
      expect(entry.message).not.toContain('already exists');
    }

    failMigrations = false;
    const retry = await buildService(healthyStore).provision(tenantId);
    expect(retry.alreadyReady).toBe(false);
    expect(retry.state).toBe('ready');
    expect(fake.createdDatabases).toHaveLength(1);
    expect(fake.createdRoles).toHaveLength(1);
    expect(migrationsRunnerCalls).toBe(2);
  });

  it('serializes concurrent attempts for one tenant into one provision plus a ready no-op', async () => {
    const tenantId = randomUUID();
    fake.addTenant(tenantId);
    const service = buildService(okSecretStore(secretStoreBehavior));

    const outcomes = await Promise.all([
      service.provision(tenantId),
      service.provision(tenantId),
      service.provision(tenantId),
    ]);

    const fresh = outcomes.filter((outcome) => !outcome.alreadyReady);
    const noop = outcomes.filter((outcome) => outcome.alreadyReady);
    expect(fresh).toHaveLength(1);
    expect(noop).toHaveLength(2);
    for (const outcome of outcomes) {
      expect(outcome.databaseName).toBe(tenantDatabaseName(tenantId));
      expect(outcome.state).toBe('ready');
    }
    expect(fake.createdDatabases).toEqual([tenantDatabaseName(tenantId)]);
    expect(fake.createdRoles).toEqual([tenantDatabaseRoleName(tenantId)]);
    expect(migrationsRunnerCalls).toBe(1);
    expect(fake.provisioningRows.get(tenantId)?.attempt).toBe(1);
  });

  it('keeps failure stage and code isolated across concurrent tenants', async () => {
    const failingTenantId = randomUUID();
    const healthyTenantId = randomUUID();
    fake.addTenant(failingTenantId);
    fake.addTenant(healthyTenantId);

    let signalStoreEntered!: () => void;
    let releaseFailingStore!: () => void;
    const storeEntered = new Promise<void>((resolve) => {
      signalStoreEntered = resolve;
    });
    const failedStoreMayReject = new Promise<void>((resolve) => {
      releaseFailingStore = resolve;
    });
    const concurrentStore: TenantSecretStore = {
      async saveTenantDatabaseCredential(tenantId) {
        if (tenantId === failingTenantId) {
          signalStoreEntered();
          await failedStoreMayReject;
          throw new Error('injected secret store failure');
        }
      },
    };
    const service = buildService(concurrentStore);

    const failingAttempt = service.provision(failingTenantId);
    await storeEntered;
    const healthyOutcome = await service.provision(healthyTenantId);
    releaseFailingStore();
    await expect(failingAttempt).rejects.toThrow(
      new TenantProvisioningError('credential', 'credential_store_failed'),
    );

    expect(healthyOutcome.state).toBe('ready');
    expect(fake.provisioningRows.get(healthyTenantId)).toMatchObject({
      stage: 'ready',
      failure_code: null,
    });
    expect(fake.tenants.get(failingTenantId)?.provisioning_state).toBe(
      'failed',
    );
    expect(fake.provisioningRows.get(failingTenantId)).toMatchObject({
      stage: 'credential',
      failure_code: 'credential_store_failed',
    });
  });

  it('exposes a sanitized description without credentials', async () => {
    const tenantId = randomUUID();
    fake.addTenant(tenantId);
    const service = buildService(okSecretStore(secretStoreBehavior));

    await service.provision(tenantId);
    const info = await service.describe(tenantId);

    expect(info).toMatchObject({
      tenantId,
      provisioningState: 'ready',
      stage: 'ready',
      failureCode: null,
      attempt: 1,
    });
    await expect(service.describe(randomUUID())).resolves.toBeNull();
    expect(await service.describe('garbage')).toBeNull();
  });
});
