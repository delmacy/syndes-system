import type { Pool, PoolClient, PoolConfig } from 'pg';
import { ServiceUnavailableException } from '@nestjs/common';
import { TenantDatabasePoolRegistry } from './tenant-database-pool.registry';
import type { TenantContext } from './identity.contracts';
import type {
  TenantDatabaseCredential,
  TenantSecretStore,
} from '../control-plane/provisioning/tenant-secret-store';
import {
  tenantDatabaseName,
  tenantDatabaseRoleName,
} from '../control-plane/provisioning/provisioning-contracts';

const tenantId = 'b001a5ce-6585-4bd0-9a67-101b423d11aa';
const databaseName = tenantDatabaseName(tenantId);
const username = tenantDatabaseRoleName(tenantId);
const context: TenantContext = {
  actorId: '1',
  tenantId,
  databaseName,
  role: 'tenant_admin',
  customerScope: 'both',
};

describe('tenant database pool registry', () => {
  const original = { ...process.env };
  afterEach(() => {
    for (const key of [
      'TENANT_DATABASE_HOST',
      'TENANT_DATABASE_PORT',
      'TENANT_DATABASE_SSL_REQUIRED',
      'TENANT_DB_POOL_SIZE',
      'TENANT_DB_POOL_LIMIT',
    ])
      delete process.env[key];
    Object.assign(process.env, original);
  });

  function configure() {
    process.env.TENANT_DATABASE_HOST = 'postgres.internal';
    process.env.TENANT_DATABASE_PORT = '5432';
    process.env.TENANT_DATABASE_SSL_REQUIRED = 'true';
    process.env.TENANT_DB_POOL_SIZE = '4';
    process.env.TENANT_DB_POOL_LIMIT = '1';
  }

  function createRegistry(
    options: {
      credential?: TenantDatabaseCredential;
      hasReader?: boolean;
    } = {},
  ) {
    const query = jest
      .fn()
      .mockResolvedValue({ rows: [{ database_name: databaseName }] });
    const controlPlane = {
      query,
    } as unknown as Pool;
    const release = jest.fn();
    const client = { release } as unknown as PoolClient;
    const tenantPool = {
      connect: jest.fn().mockResolvedValue(client),
      end: jest.fn(),
    } as unknown as Pool;
    const createPool = jest.fn((config: PoolConfig) => {
      void config;
      return tenantPool;
    });
    const secretStore: TenantSecretStore = {
      saveTenantDatabaseCredential: jest.fn(),
      ...(options.hasReader === false
        ? {}
        : {
            getTenantDatabaseCredential: jest.fn().mockResolvedValue(
              options.credential ?? {
                databaseName,
                username,
                password: 'test-only-password',
              },
            ),
          }),
    };
    return {
      registry: new TenantDatabasePoolRegistry(
        controlPlane,
        secretStore,
        createPool,
      ),
      controlPlane,
      query,
      client,
      release,
      tenantPool,
      createPool,
    };
  }

  it('acquires only the Control Plane-resolved database and releases the client', async () => {
    configure();
    const { registry, query, release, createPool } = createRegistry();
    await expect(
      registry.withClient(context, () => Promise.resolve('ok')),
    ).resolves.toBe('ok');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("provisioning_state = 'ready'"),
      [tenantId],
    );
    expect(createPool).toHaveBeenCalledWith(
      expect.objectContaining({
        database: databaseName,
        ssl: { rejectUnauthorized: true },
        max: 4,
      }),
    );
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('rejects caller-selected database names and fails closed without a secret reader', async () => {
    configure();
    const { registry, createPool } = createRegistry();
    await expect(
      registry.withClient(
        { ...context, databaseName: 'another_database' },
        () => Promise.resolve(null),
      ),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(createPool).not.toHaveBeenCalled();
    const noReader = createRegistry({ hasReader: false });
    await expect(
      noReader.registry.withClient(context, () => Promise.resolve(null)),
    ).rejects.toThrow('Tenant credential reader is not configured');
    expect(noReader.createPool).not.toHaveBeenCalled();
  });

  it('binds credentials to the provisioning-derived database and role names', async () => {
    configure();
    const { registry, createPool } = createRegistry({
      credential: {
        databaseName,
        username: tenantDatabaseRoleName(
          'd001a5ce-6585-4bd0-9a67-101b423d11aa',
        ),
        password: 'test-only-password',
      },
    });
    await expect(
      registry.withClient(context, () => Promise.resolve(null)),
    ).rejects.toThrow('credential mapping is invalid');
    expect(createPool).not.toHaveBeenCalled();
  });

  it('requires explicit TLS and measured pool bounds and rejects over-capacity tenants', async () => {
    const registryWithoutConfig = createRegistry();
    await expect(
      registryWithoutConfig.registry.withClient(context, () =>
        Promise.resolve(null),
      ),
    ).rejects.toThrow('must be explicitly configured');
    configure();
    const { registry, createPool } = createRegistry();
    await registry.withClient(context, () => Promise.resolve(null));
    const second = {
      ...context,
      tenantId: 'c001a5ce-6585-4bd0-9a67-101b423d11aa',
    };
    await expect(
      registry.withClient(second, () => Promise.resolve(null)),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(createPool).toHaveBeenCalledTimes(1);
  });
});
