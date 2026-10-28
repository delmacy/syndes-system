import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { Pool, type PoolClient } from 'pg';
import { AppModule } from '../src/app.module';
import {
  CONTROL_PLANE_DATABASE,
  TENANT_SECRET_STORE,
} from '../src/modules/platform-core/platform-core.module';
import { TenantDatabasePoolRegistry } from '../src/modules/platform-core/identity/tenant-database-pool.registry';
import type { TenantContext } from '../src/modules/platform-core/identity/identity.contracts';
import type {
  TenantDatabaseCredential,
  TenantSecretStore,
} from '../src/modules/platform-core/control-plane/provisioning/tenant-secret-store';
import { TenantProvisioningService } from '../src/modules/platform-core/control-plane/provisioning/tenant-provisioning.service';
import {
  tenantDatabaseName,
  tenantDatabaseRoleName,
} from '../src/modules/platform-core/control-plane/provisioning/provisioning-contracts';
import { registerCsvBodyParser } from '../src/modules/core-crm/csv/csv-body-parser';

const tenantId = 'ae2e174a-ef1c-496f-bf34-80727a87e799';
const issuer = process.env.KEYCLOAK_ISSUER;
const subject = 'f28625de-00fd-4a6a-a57c-fc06b0498664';
const credentials = new Map<string, TenantDatabaseCredential>();
const pools = new Map<string, Pool>();
const secretStore: TenantSecretStore = {
  async saveTenantDatabaseCredential(id, credential) {
    credentials.set(id, credential);
    await Promise.resolve();
  },
  async getTenantDatabaseCredential(id) {
    const credential = credentials.get(id);
    if (!credential)
      throw new Error('Acceptance tenant credential is missing.');
    await Promise.resolve();
    return credential;
  },
};

const testRegistry = {
  async withClient<T>(
    context: TenantContext,
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    if (
      context.tenantId !== tenantId ||
      context.databaseName !== tenantDatabaseName(tenantId)
    ) {
      throw new Error(
        'Acceptance registry rejected unexpected tenant context.',
      );
    }
    let pool = pools.get(tenantId);
    if (!pool) {
      const credential = credentials.get(tenantId);
      if (
        !credential ||
        credential.username !== tenantDatabaseRoleName(tenantId)
      ) {
        throw new Error('Acceptance tenant credential mapping is invalid.');
      }
      pool = new Pool({
        host: process.env.TEST_DATABASE_HOST ?? '127.0.0.1',
        port: Number(process.env.TEST_DATABASE_PORT ?? 5432),
        database: credential.databaseName,
        user: credential.username,
        password: credential.password,
        ssl: false,
        max: 4,
        application_name: 'syndes-crm-acceptance-test',
      });
      pools.set(tenantId, pool);
    }
    const client = await pool.connect();
    try {
      return await work(client);
    } finally {
      client.release();
    }
  },
  async onApplicationShutdown() {
    await Promise.all([...pools.values()].map((pool) => pool.end()));
    pools.clear();
    credentials.clear();
  },
};

async function bootstrap() {
  if (!issuer) throw new Error('KEYCLOAK_ISSUER is required.');
  const testingModule = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(TENANT_SECRET_STORE)
    .useValue(secretStore)
    .overrideProvider(TenantDatabasePoolRegistry)
    .useValue(testRegistry)
    .compile();

  const controlPlane = testingModule.get<Pool>(CONTROL_PLANE_DATABASE);
  const provisioning = testingModule.get(TenantProvisioningService);
  await controlPlane.query(
    `INSERT INTO tenants (id, display_name, database_name, provisioning_state)
     VALUES ($1, 'CRM Acceptance Tenant', $2, 'pending')
     ON CONFLICT (id) DO UPDATE SET provisioning_state = 'pending'`,
    [tenantId, tenantDatabaseName(tenantId)],
  );
  await provisioning.provision(tenantId);

  const actor = await controlPlane.query<{ id: string }>(
    `INSERT INTO identity_actors (issuer, subject, platform_admin)
     VALUES ($1, $2, false)
     ON CONFLICT (issuer, subject) DO UPDATE SET platform_admin = false
     RETURNING id`,
    [issuer, subject],
  );
  await controlPlane.query(
    `INSERT INTO tenant_domains (hostname, tenant_id, status)
     VALUES ('localhost', $1, 'active')
     ON CONFLICT (hostname) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, status = 'active'`,
    [tenantId],
  );
  await controlPlane.query(
    `INSERT INTO tenant_memberships (tenant_id, actor_id, role, customer_scope, status)
     VALUES ($1, $2, 'tenant_admin', 'both', 'active')
     ON CONFLICT (tenant_id, actor_id) DO UPDATE
       SET role = 'tenant_admin', customer_scope = 'both', status = 'active'`,
    [tenantId, actor.rows[0].id],
  );

  const app = testingModule.createNestApplication();
  registerCsvBodyParser(app);
  app.enableShutdownHooks();
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`CRM acceptance API listening on ${port}; tenant provisioned.`);
}

void bootstrap().catch((error: unknown) => {
  console.error('CRM acceptance API bootstrap failed:', error);
  process.exitCode = 1;
});
