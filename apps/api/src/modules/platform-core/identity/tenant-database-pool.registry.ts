import {
  Injectable,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Pool, type PoolClient, type PoolConfig } from 'pg';
import type {
  TenantSecretStore,
  TenantDatabaseCredential,
} from '../control-plane/provisioning/tenant-secret-store';
import {
  isValidTenantUuid,
  tenantDatabaseName,
  tenantDatabaseRoleName,
} from '../control-plane/provisioning/provisioning-contracts';
import type { TenantContext } from './identity.contracts';

export class TenantDatabasePoolConfigurationError extends Error {
  constructor() {
    super(
      'Tenant database TLS, host, pool size, and pool limit must be explicitly configured.',
    );
    this.name = 'TenantDatabasePoolConfigurationError';
  }
}

@Injectable()
export class TenantDatabasePoolRegistry implements OnApplicationShutdown {
  private readonly pools = new Map<
    string,
    { databaseName: string; pool: Pool }
  >();

  constructor(
    private readonly controlPlane: Pool,
    private readonly secretStore: TenantSecretStore,
    private readonly createPool: (config: PoolConfig) => Pool = (config) =>
      new Pool(config),
  ) {}

  async withClient<T>(
    context: TenantContext,
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    if (!isValidTenantUuid(context.tenantId))
      throw new ServiceUnavailableException();
    const pool = await this.resolvePool(context);
    const client = await pool.connect();
    try {
      return await work(client);
    } finally {
      client.release();
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled(
      [...this.pools.values()].map(({ pool }) => pool.end()),
    );
    this.pools.clear();
  }

  private async resolvePool(context: TenantContext): Promise<Pool> {
    const existing = this.pools.get(context.tenantId);
    if (existing) {
      if (existing.databaseName !== context.databaseName)
        throw new ServiceUnavailableException();
      return existing.pool;
    }

    const config = readPoolConfig();
    if (this.pools.size >= config.maxTenantPools)
      throw new ServiceUnavailableException(
        'Tenant database pool capacity reached',
      );
    const registry = await this.controlPlane.query<{ database_name: string }>(
      `SELECT database_name FROM tenants WHERE id = $1 AND provisioning_state = 'ready'`,
      [context.tenantId],
    );
    const databaseName = registry.rows[0]?.database_name;
    if (!databaseName || databaseName !== context.databaseName)
      throw new ServiceUnavailableException();
    if (!this.secretStore.getTenantDatabaseCredential)
      throw new ServiceUnavailableException(
        'Tenant credential reader is not configured',
      );
    const credential = await this.secretStore.getTenantDatabaseCredential(
      context.tenantId,
    );
    assertCredentialMatches(context.tenantId, databaseName, credential);

    const pool = this.createPool({
      host: config.host,
      port: config.port,
      database: databaseName,
      user: credential.username,
      password: credential.password,
      ssl: { rejectUnauthorized: true },
      max: config.poolSize,
      application_name: 'syndes-api-tenant',
    });
    this.pools.set(context.tenantId, { databaseName, pool });
    return pool;
  }
}

function assertCredentialMatches(
  tenantId: string,
  databaseName: string,
  credential: TenantDatabaseCredential,
): void {
  if (
    credential.databaseName !== databaseName ||
    databaseName !== tenantDatabaseName(tenantId) ||
    credential.username !== tenantDatabaseRoleName(tenantId) ||
    !credential.password
  )
    throw new ServiceUnavailableException(
      'Tenant database credential mapping is invalid',
    );
}

function readPoolConfig() {
  const host = process.env.TENANT_DATABASE_HOST?.trim();
  const port = positiveInt(process.env.TENANT_DATABASE_PORT);
  const poolSize = positiveInt(process.env.TENANT_DB_POOL_SIZE);
  const maxTenantPools = positiveInt(process.env.TENANT_DB_POOL_LIMIT);
  if (
    !host ||
    !port ||
    !poolSize ||
    !maxTenantPools ||
    process.env.TENANT_DATABASE_SSL_REQUIRED !== 'true'
  ) {
    throw new TenantDatabasePoolConfigurationError();
  }
  return { host, port, poolSize, maxTenantPools };
}

function positiveInt(value?: string): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}
