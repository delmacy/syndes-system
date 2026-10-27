import { Logger } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import {
  ProvisioningFailureCode,
  ProvisioningStage,
  ProvisioningState,
  generateTenantRolePassword,
  isTransitionAllowed,
  isValidTenantUuid,
  quotePgIdentifier,
  quotePgLiteral,
  tenantAdvisoryLockKey,
  tenantDatabaseName,
  tenantDatabaseRoleName,
} from './provisioning-contracts';
import { runTenantMigrations } from './tenant-migration-runner';
import type { TenantSecretStore } from './tenant-secret-store';

export interface TenantProvisioningLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface TenantProvisioningOptions {
  /**
   * Server-resolved connection string for tenant database administration.
   * Required for database/role creation and tenant migrations; requests
   * never contribute values to it.
   */
  adminConnectionString: string;
  /** Dedicated server-side pool for tenant database/role administration. */
  adminPool: Pool;
  migrationsFolder?: string;
  logger?: TenantProvisioningLogger;
  /**
   * Applies reviewed tenant migrations to the tenant database. Defaults to
   * the approved drizzle runner; injection is for tests only.
   */
  migrationsRunner?: (
    tenantPool: Pool,
    migrationsFolder?: string,
  ) => Promise<void>;
  /**
   * Opens the admin connection to one tenant database. Defaults to a `pg`
   * Pool from the configured admin connection string; injection is for
   * tests only.
   */
  tenantAdminPoolFactory?: (databaseName: string) => Pool;
}

export interface ProvisionTenantOutcome {
  tenantId: string;
  databaseName: string;
  state: ProvisioningState;
  alreadyReady: boolean;
}

export interface TenantProvisioningInfo {
  tenantId: string;
  provisioningState: ProvisioningState;
  stage: ProvisioningStage;
  failureCode: ProvisioningFailureCode | null;
  attempt: number;
}

interface TenantSummary {
  id: string;
  databaseName: string;
  provisioningState: ProvisioningState;
}

interface ProvisioningAttemptRow {
  attempt: number;
  stage: ProvisioningStage;
  failure_code: string | null;
}

export class TenantProvisioningError extends Error {
  constructor(
    readonly stage: ProvisioningStage,
    readonly failureCode: ProvisioningFailureCode,
  ) {
    super(`Tenant provisioning failed at stage ${stage} (${failureCode}).`);
    this.name = 'TenantProvisioningError';
  }
}

export class TenantProvisioningNotFoundError extends Error {
  constructor() {
    super('Tenant not found for provisioning.');
    this.name = 'TenantProvisioningNotFoundError';
  }
}

export class TenantDatabaseNameMismatchError extends Error {
  constructor() {
    super(
      'Stored tenant database reference does not match the name generated from the permanent tenant UUID.',
    );
    this.name = 'TenantDatabaseNameMismatchError';
  }
}

const TENANT_SUMMARY_QUERY = `SELECT id, database_name, provisioning_state FROM tenants WHERE id = $1`;

/**
 * CRM-02 idempotent tenant database provisioning.
 *
 * Guarantees implemented here:
 * - State machine `pending -> in_progress -> ready | failed`; retry
 *   `failed -> in_progress`; a `ready` tenant is an idempotent no-op (no
 *   database, role, credential, or migration work happens).
 * - Database and least-privilege role names are generated ONLY from the
 *   permanent tenant UUID (never display names, never request values).
 * - A single worker holds a per-tenant advisory lock, so concurrent
 *   provisioning attempts for one tenant are serialized and duplicate
 *   resources are impossible; losers observe the resulting state.
 * - Canonical state and sanitized attempt data persist durably in the
 *   Control Plane (`tenants.provisioning_state` and `tenant_provisioning`).
 * - Tenant migrations run ONLY outside API startup, after the tenant is
 *   claimed, resuming from the Drizzle journal inside the tenant database.
 * - Failures keep durable sanitized stage/failure codes; raw error text,
 *   SQL, credentials, and connection strings never reach rows, logs, or
 *   thrown errors.
 * - Credentials are generated in memory, handed to the configured tenant
 *   secret store before role creation, and never stored or logged anywhere
 *   else (the concrete store remains an explicit deployment decision).
 */
export class TenantProvisioningService {
  private readonly logger: TenantProvisioningLogger;

  constructor(
    private readonly pool: Pool,
    private readonly secretStore: TenantSecretStore,
    private readonly options: TenantProvisioningOptions,
  ) {
    this.logger =
      options.logger ??
      (() => {
        const nest = new Logger(TenantProvisioningService.name);
        return {
          info: (message: string) => nest.log(message),
          warn: (message: string) => nest.warn(message),
          error: (message: string) => nest.error(message),
        } satisfies TenantProvisioningLogger;
      })();
  }

  private get adminPool(): Pool {
    return this.options.adminPool;
  }

  /**
   * Provisions (or idempotently re-provisions) a tenant database. Throws a
   * sanitized {@link TenantProvisioningError} on failure; callers may retry
   * the same tenant safely.
   */
  async provision(tenantId: string): Promise<ProvisionTenantOutcome> {
    if (!isValidTenantUuid(tenantId)) {
      throw new TenantProvisioningNotFoundError();
    }
    const tenant = await this.loadTenant(tenantId);
    if (!tenant) {
      throw new TenantProvisioningNotFoundError();
    }
    const databaseName = tenantDatabaseName(tenant.id);
    if (tenant.databaseName !== databaseName) {
      this.logger.warn(
        `Provisioning guard: registry database reference does not match the UUID-derived name (tenant ${tenant.id}).`,
      );
      throw new TenantDatabaseNameMismatchError();
    }
    if (tenant.provisioningState === 'ready') {
      return { tenantId, databaseName, state: 'ready', alreadyReady: true };
    }

    const lockKey = tenantAdvisoryLockKey(tenantId);
    const client = await this.pool.connect();
    try {
      await this.acquireTenantLock(client, lockKey);
      return await this.provisionUnderLock(client, tenantId);
    } finally {
      try {
        await this.releaseTenantLock(client, lockKey);
      } finally {
        client.release();
      }
    }
  }

  /** Sanitized non-secret view of a tenant's provisioning state. */
  async describe(tenantId: string): Promise<TenantProvisioningInfo | null> {
    if (!isValidTenantUuid(tenantId)) {
      return null;
    }
    const tenant = await this.loadTenant(tenantId);
    if (!tenant) {
      return null;
    }
    const attempt = await this.pool.query<ProvisioningAttemptRow>(
      `SELECT attempt, stage, failure_code FROM tenant_provisioning WHERE tenant_id = $1`,
      [tenantId],
    );
    const row = attempt.rows[0];
    return {
      tenantId,
      provisioningState: tenant.provisioningState,
      stage: row?.stage ?? 'claimed',
      failureCode: (row?.failure_code as ProvisioningFailureCode) ?? null,
      attempt: row?.attempt ?? 0,
    };
  }

  private async provisionUnderLock(
    client: PoolClient,
    tenantId: string,
  ): Promise<ProvisionTenantOutcome> {
    const tenant = await this.loadTenantWith(client, tenantId);
    if (!tenant) {
      throw new TenantProvisioningNotFoundError();
    }
    const databaseName = tenantDatabaseName(tenant.id);
    if (tenant.databaseName !== databaseName) {
      throw new TenantDatabaseNameMismatchError();
    }
    if (tenant.provisioningState === 'ready') {
      return { tenantId, databaseName, state: 'ready', alreadyReady: true };
    }

    const roleName = tenantDatabaseRoleName(tenantId);
    const attemptCredential: { password: string | undefined } = {
      password: undefined,
    };
    let claimed = false;
    try {
      await this.claimProvisioning(client, tenant);
      claimed = true;
      await this.executeProvisioningSteps(
        client,
        tenantId,
        { databaseName, roleName },
        attemptCredential,
      );
    } catch (error) {
      if (error instanceof TenantProvisioningNotFoundError) {
        throw error;
      }
      const failure =
        error instanceof TenantProvisioningError
          ? error
          : new TenantProvisioningError(
              'claimed',
              'control_plane_update_failed',
            );
      if (claimed) {
        await this.recordSanitizedFailure(client, tenantId, failure);
      } else {
        this.logger.error(
          `Provisioning claim failed (tenant ${tenantId}); database details omitted.`,
        );
      }
      throw failure;
    }

    this.logger.info(
      `Tenant database ready (tenant ${tenantId}, database ${databaseName}); migrations applied outside API startup.`,
    );
    return { tenantId, databaseName, state: 'ready', alreadyReady: false };
  }

  private async executeProvisioningSteps(
    client: PoolClient,
    tenantId: string,
    names: { databaseName: string; roleName: string },
    attemptCredential: { password: string | undefined },
  ): Promise<void> {
    const stageRuns: readonly {
      stage: ProvisioningStage;
      failureCode: ProvisioningFailureCode;
      run: () => Promise<void>;
    }[] = [
      {
        stage: 'database',
        failureCode: 'database_create_failed',
        run: () => this.ensureTenantDatabase(names.databaseName),
      },
      {
        stage: 'credential',
        failureCode: 'credential_store_failed',
        run: () =>
          this.saveCredential(
            tenantId,
            names.databaseName,
            names.roleName,
            attemptCredential,
          ),
      },
      {
        stage: 'role',
        failureCode: 'role_create_failed',
        run: () =>
          this.ensureTenantRoleAndGrants(
            names.databaseName,
            names.roleName,
            attemptCredential,
          ),
      },
      {
        stage: 'migrations',
        failureCode: 'migration_failed',
        run: () => this.runTenantMigrationsTask(names.databaseName),
      },
    ];

    for (const step of stageRuns) {
      try {
        await step.run();
      } catch {
        throw new TenantProvisioningError(step.stage, step.failureCode);
      }
      try {
        await this.recordStage(client, tenantId, step.stage, null);
      } catch {
        throw new TenantProvisioningError(
          step.stage,
          'control_plane_update_failed',
        );
      }
    }

    try {
      await this.markReady(client, tenantId);
    } catch {
      throw new TenantProvisioningError('ready', 'ready_update_failed');
    }
  }

  /**
   * Takes per-tenant ownership of unfinished provisioning. `pending` and
   * `failed` are CRM-00 transitions; `in_progress` here means a previous
   * owner died mid-attempt and the work is stale — resumable by the lock
   * holder. Ownership itself is atomic (conditional UPDATE on the state).
   */
  private async claimProvisioning(
    client: PoolClient,
    tenant: TenantSummary,
  ): Promise<void> {
    const claimable: readonly ProvisioningState[] = [
      'pending',
      'failed',
      'in_progress',
    ];
    if (!claimable.includes(tenant.provisioningState)) {
      throw new TenantProvisioningNotFoundError();
    }
    if (
      tenant.provisioningState !== 'in_progress' &&
      !isTransitionAllowed(tenant.provisioningState, 'in_progress')
    ) {
      throw new TenantProvisioningNotFoundError();
    }
    await client.query('BEGIN');
    try {
      const claimed = await client.query(
        `UPDATE tenants
         SET provisioning_state = 'in_progress', updated_at = now()
         WHERE id = $1 AND provisioning_state = $2`,
        [tenant.id, tenant.provisioningState],
      );
      if (claimed.rowCount !== 1) {
        throw new TenantProvisioningNotFoundError();
      }
      // State transition and durable attempt record commit together.
      await client.query(
        `INSERT INTO tenant_provisioning (tenant_id, attempt, stage, failure_code)
         VALUES ($1, 1, 'claimed', NULL)
         ON CONFLICT (tenant_id) DO UPDATE
           SET attempt = tenant_provisioning.attempt + 1,
               stage = EXCLUDED.stage,
               failure_code = NULL,
               started_at = now(),
               updated_at = now(),
               finished_at = NULL`,
        [tenant.id],
      );
      await client.query('COMMIT');
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the sanitized caller path if the connection is already lost.
      }
      throw error;
    }
    this.logger.info(
      `Provisioning claimed (tenant ${tenant.id}, database ${tenant.databaseName}, from ${tenant.provisioningState}).`,
    );
  }

  private async ensureTenantDatabase(databaseName: string): Promise<void> {
    const exists = await this.adminPool.query<{ ok: number }>(
      `SELECT 1 AS ok FROM pg_database WHERE datname = $1`,
      [databaseName],
    );
    if (exists.rowCount !== 0) {
      return;
    }
    // Safe: databaseName is generated from the validated tenant UUID and is
    // re-checked by the quoting helper before entering SQL.
    await this.adminPool.query(
      `CREATE DATABASE ${quotePgIdentifier(databaseName)}`,
    );
  }

  private async saveCredential(
    tenantId: string,
    databaseName: string,
    roleName: string,
    attemptCredential: { password: string | undefined },
  ): Promise<void> {
    // Generated in memory only; handed to the configured secret store and
    // never logged, persisted in the Control Plane, or returned.
    attemptCredential.password = generateTenantRolePassword();
    await this.secretStore.saveTenantDatabaseCredential(tenantId, {
      databaseName,
      username: roleName,
      password: attemptCredential.password,
    });
  }

  private async ensureTenantRoleAndGrants(
    databaseName: string,
    roleName: string,
    attemptCredential: { password: string | undefined },
  ): Promise<void> {
    const password = attemptCredential.password;
    if (!password) {
      throw new Error('Attempt credential was not generated.');
    }
    const exists = await this.adminPool.query<{ ok: number }>(
      `SELECT 1 AS ok FROM pg_roles WHERE rolname = $1`,
      [roleName],
    );
    if (exists.rowCount === 0) {
      await this.adminPool.query(
        `CREATE ROLE ${quotePgIdentifier(roleName)} LOGIN PASSWORD ${quotePgLiteral(password)} NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT`,
      );
    } else {
      // A previous attempt may have created the role with a credential that
      // was never durably stored; align it with this attempt's credential.
      await this.adminPool.query(
        `ALTER ROLE ${quotePgIdentifier(roleName)} LOGIN PASSWORD ${quotePgLiteral(password)}`,
      );
    }

    const tenantPool = this.createTenantAdminPool(databaseName);
    try {
      const grantsClient = await tenantPool.connect();
      try {
        // LOCKED/least privilege: only this tenant role may connect to its
        // own database; PUBLIC connectivity and schema-wide defaults are
        // removed at creation time.
        await grantsClient.query(
          `REVOKE ALL ON DATABASE ${quotePgIdentifier(databaseName)} FROM PUBLIC`,
        );
        await grantsClient.query(
          `GRANT CONNECT ON DATABASE ${quotePgIdentifier(databaseName)} TO ${quotePgIdentifier(roleName)}`,
        );
        await grantsClient.query(
          `GRANT USAGE, CREATE ON SCHEMA public TO ${quotePgIdentifier(roleName)}`,
        );
      } finally {
        grantsClient.release();
      }
    } finally {
      await tenantPool.end();
    }
  }

  private createTenantAdminPool(databaseName: string): Pool {
    const factory = this.options.tenantAdminPoolFactory;
    if (factory) {
      return factory(databaseName);
    }
    return new Pool({ connectionString: this.tenantAdminUrl(databaseName) });
  }

  /** Builds the tenant URL server-side; never logged or returned. */
  private tenantAdminUrl(databaseName: string): string {
    if (!/^[a-z_][a-z0-9_]{0,62}$/.test(databaseName)) {
      throw new Error('Unsafe tenant database name rejected.');
    }
    if (!this.options.adminConnectionString) {
      throw new Error(
        'No tenant admin connection string is configured for provisioning.',
      );
    }
    const url = new URL(this.options.adminConnectionString);
    url.pathname = `/${databaseName}`;
    return url.toString();
  }

  private async runTenantMigrationsTask(databaseName: string): Promise<void> {
    const tenantPool = this.createTenantAdminPool(databaseName);
    try {
      const runner =
        this.options.migrationsRunner ??
        ((tenantPool: Pool, migrationsFolder?: string) =>
          runTenantMigrations(tenantPool, migrationsFolder));
      await runner(tenantPool, this.options.migrationsFolder);
    } finally {
      await tenantPool.end();
    }
  }

  private async markReady(client: PoolClient, tenantId: string): Promise<void> {
    await client.query('BEGIN');
    try {
      const ready = await client.query(
        `UPDATE tenants
         SET provisioning_state = 'ready', updated_at = now()
         WHERE id = $1 AND provisioning_state = 'in_progress'`,
        [tenantId],
      );
      if (ready.rowCount !== 1) {
        throw new Error('Tenant ready transition lost its claim.');
      }
      await client.query(
        `UPDATE tenant_provisioning
         SET stage = 'ready', failure_code = NULL, updated_at = now(), finished_at = now()
         WHERE tenant_id = $1`,
        [tenantId],
      );
      await client.query(
        `INSERT INTO audit_events (tenant_id, actor_id, action, resource_type, resource_id, result)
         VALUES ($1, NULL, 'tenant.provisioning.ready', 'tenant', $1, 'success')`,
        [tenantId],
      );
      await client.query('COMMIT');
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the sanitized caller path if the connection is already lost.
      }
      throw error;
    }
  }

  /**
   * Failure path: persists the sanitized stage + stable failure code and
   * moves the canonical state to `failed`. Durable partial state (database,
   * role, migration journal) stays untouched and safe for retry. The
   * original sanitized error is always what reaches the caller.
   */
  private async recordSanitizedFailure(
    client: PoolClient,
    tenantId: string,
    failure: TenantProvisioningError,
  ): Promise<void> {
    const { stage, failureCode } = failure;
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE tenants
         SET provisioning_state = 'failed', updated_at = now()
         WHERE id = $1 AND provisioning_state = 'in_progress'`,
        [tenantId],
      );
      await client.query(
        `UPDATE tenant_provisioning
         SET stage = $2, failure_code = $3, updated_at = now(), finished_at = now()
         WHERE tenant_id = $1`,
        [tenantId, stage, failureCode],
      );
      await client.query('COMMIT');
      this.logger.warn(
        `Provisioning failed (tenant ${tenantId}, stage ${stage}, code ${failureCode}); partial state kept for retry.`,
      );
    } catch {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Do not replace the original sanitized provisioning error.
      }
      this.logger.error(
        `Provisioning failure record could not be persisted (tenant ${tenantId}, stage ${stage}, code ${failureCode}).`,
      );
    }
  }

  private async recordStage(
    client: PoolClient,
    tenantId: string,
    stage: ProvisioningStage,
    failureCode: ProvisioningFailureCode | null,
  ): Promise<void> {
    await client.query(
      `UPDATE tenant_provisioning
       SET stage = $2, failure_code = $3, updated_at = now()
       WHERE tenant_id = $1`,
      [tenantId, stage, failureCode],
    );
  }

  private async acquireTenantLock(
    client: PoolClient,
    lockKey: bigint,
  ): Promise<void> {
    await client.query('SELECT pg_advisory_lock($1)', [lockKey.toString()]);
  }

  private async releaseTenantLock(
    client: PoolClient,
    lockKey: bigint,
  ): Promise<void> {
    await client.query('SELECT pg_advisory_unlock($1)', [lockKey.toString()]);
  }

  private async loadTenant(tenantId: string): Promise<TenantSummary | null> {
    const result = await this.pool.query<{
      id: string;
      database_name: string;
      provisioning_state: ProvisioningState;
    }>(TENANT_SUMMARY_QUERY, [tenantId]);
    return this.toSummary(result.rows[0]);
  }

  private async loadTenantWith(
    client: PoolClient,
    tenantId: string,
  ): Promise<TenantSummary | null> {
    const result = await client.query<{
      id: string;
      database_name: string;
      provisioning_state: ProvisioningState;
    }>(TENANT_SUMMARY_QUERY, [tenantId]);
    return this.toSummary(result.rows[0]);
  }

  private toSummary(
    row:
      | {
          id: string;
          database_name: string;
          provisioning_state: ProvisioningState;
        }
      | undefined,
  ): TenantSummary | null {
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      databaseName: row.database_name,
      provisioningState: row.provisioning_state,
    };
  }
}
