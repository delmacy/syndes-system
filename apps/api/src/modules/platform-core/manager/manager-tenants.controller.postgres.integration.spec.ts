import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Pool } from 'pg';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { quotePgIdentifier } from '../control-plane/provisioning/provisioning-contracts';
import type {
  TenantDatabaseCredential,
  TenantSecretStore,
} from '../control-plane/provisioning/tenant-secret-store';
import { IdentityTokenVerifier } from '../identity/identity-token-verifier';
import {
  PlatformCoreModule,
  TENANT_SECRET_STORE,
} from '../platform-core.module';
import { ManagerModule } from './manager.module';

const TENANT_INTEGRATION_TIMEOUT_MS = 180000;
const configuredIssuer = 'https://id.test/realms/syndes';
const ADMIN = 'admin-mfa-token';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const describeIntegration = process.env.CONTROL_PLANE_DATABASE_URL
  ? describe
  : describe.skip;

/**
 * CRM-04 integration + contract proof over disposable PostgreSQL 16: the
 * full Platform Core manager stack (real Control Plane data, guards, DTOs,
 * audit, and the CRM-02 provisioning service) driven over HTTP.
 * Skipped when no disposable CONTROL_PLANE_DATABASE_URL is bound locally;
 * runs inside the API CI job.
 */
describeIntegration('CRM-04 manager tenants (disposable PostgreSQL)', () => {
  let app: INestApplication;
  let adminPool: Pool;
  let secretStore: PoisonableInMemoryTenantSecretStore;
  const disposableNames: { databases: string[]; roles: string[] } = {
    databases: [],
    roles: [],
  };

  jest.setTimeout(TENANT_INTEGRATION_TIMEOUT_MS);

  class PoisonableInMemoryTenantSecretStore implements TenantSecretStore {
    readonly records = new Map<string, TenantDatabaseCredential>();
    readonly poisonedTenantIds = new Set<string>();

    saveTenantDatabaseCredential(
      tenantId: string,
      credential: TenantDatabaseCredential,
    ): Promise<void> {
      if (this.poisonedTenantIds.has(tenantId)) {
        return Promise.reject(
          new Error(
            'poisoned store admin:topsecret@secretstore.internal:8443 tok_val',
          ),
        );
      }
      this.records.set(tenantId, credential);
      return Promise.resolve();
    }
  }

  const projectDir = process.cwd();
  const cpApplyScript = path.join(
    projectDir,
    'scripts',
    'apply-control-plane-migrations.mjs',
  );

  beforeAll(async () => {
    adminPool = new Pool({
      connectionString: process.env.CONTROL_PLANE_DATABASE_URL,
    });
    execFileSync(process.execPath, [cpApplyScript], {
      env: process.env,
      stdio: 'inherit',
      cwd: projectDir,
    });
    await adminPool.query(`TRUNCATE TABLE
      audit_events, tenant_memberships, tenant_provisioning, tenants,
      identity_actors, tenant_domains RESTART IDENTITY CASCADE`);

    await adminPool.query(
      `INSERT INTO identity_actors (issuer, subject, platform_admin)
       VALUES ($1, 'admin-subject', true),
              ($1, 'member-subject', false),
              ($1, 'target-subject', false)`,
      [configuredIssuer],
    );

    secretStore = new PoisonableInMemoryTenantSecretStore();

    const moduleRef = await Test.createTestingModule({
      imports: [PlatformCoreModule, ManagerModule],
    })
      .overrideProvider(IdentityTokenVerifier)
      .useValue({
        verify: (token: string) => {
          const identities: Record<
            string,
            { issuer: string; subject: string; acr?: string }
          > = {
            'admin-mfa-token': {
              issuer: configuredIssuer,
              subject: 'admin-subject',
              acr: 'mfa',
            },
            'admin-plain-token': {
              issuer: configuredIssuer,
              subject: 'admin-subject',
              acr: 'pwd',
            },
            'member-token': {
              issuer: configuredIssuer,
              subject: 'member-subject',
              acr: 'mfa',
            },
          };
          const identity = identities[token];
          if (!identity) return Promise.reject(new Error('invalid token'));
          return Promise.resolve({
            ...identity,
            audience: ['syndes-api'],
            authorizedParty: 'syndes-web',
          });
        },
      })
      .overrideProvider('MANAGER_CONFIGURED_KEYCLOAK_ISSUER')
      .useValue(configuredIssuer)
      // Test-only binding of the deployment approval boundary: CI uses an
      // in-memory secret store instead of the fail-closed runtime store.
      .overrideProvider(TENANT_SECRET_STORE)
      .useValue(secretStore)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  }, TENANT_INTEGRATION_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
    for (const databaseName of disposableNames.databases) {
      await adminPool
        .query(
          `DROP DATABASE IF EXISTS ${quotePgIdentifier(databaseName)} WITH (FORCE)`,
        )
        .catch(() => undefined);
    }
    for (const roleName of disposableNames.roles) {
      await adminPool
        .query(`DROP ROLE IF EXISTS ${quotePgIdentifier(roleName)}`)
        .catch(() => undefined);
    }
    await adminPool.end();
  }, TENANT_INTEGRATION_TIMEOUT_MS);

  function server(): unknown {
    return app.getHttpServer();
  }

  function get(path: string, token: string = ADMIN) {
    return request(server()).get(path).set('authorization', `Bearer ${token}`);
  }

  function post(path: string, body?: unknown, token: string = ADMIN) {
    const agent = request(server())
      .post(path)
      .set('content-type', 'application/json')
      .set('authorization', `Bearer ${token}`);
    return typeof body === 'undefined' ? agent : agent.send(body);
  }

  function patch(path: string, body: unknown, token: string = ADMIN) {
    return request(server())
      .patch(path)
      .set('content-type', 'application/json')
      .set('authorization', `Bearer ${token}`)
      .send(body);
  }

  function bodyOf(response: { text: string }): Record<string, unknown> {
    return JSON.parse(response.text) as Record<string, unknown>;
  }

  async function auditActions(tenantId: string): Promise<string[]> {
    const result = await adminPool.query<{
      action: string;
      actor_id: string | null;
    }>(
      `SELECT action, actor_id FROM audit_events
        WHERE tenant_id = $1
        ORDER BY occurred_at, action`,
      [tenantId],
    );
    return result.rows.map((row) => row.action);
  }

  function assertSecretFree(value: string): void {
    for (const forbidden of [
      'sdb_',
      'tapp_',
      'postgres://',
      'postgresql://',
      'password',
      'topsecret',
      'tok_val',
      'secretstore.internal',
      'connectionstring',
    ]) {
      expect(value).not.toContain(forbidden);
    }
  }

  it('denies every manager route without Platform Admin + MFA', async () => {
    const unauthenticated = await get('/api/v1/platform-admin/tenants', '');
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.type).toBe('application/problem+json');
    expect(bodyOf(unauthenticated)).toMatchObject({
      status: 401,
      code: 'unauthorized',
    });
    expect(bodyOf(unauthenticated).requestId).toBeDefined();

    const mfaMissing = await get(
      '/api/v1/platform-admin/tenants',
      'admin-plain-token',
    );
    expect(mfaMissing.status).toBe(403);
    expect(mfaMissing.type).toBe('application/problem+json');
    expect(bodyOf(mfaMissing)).toMatchObject({
      status: 403,
      code: 'forbidden',
    });
    expect(JSON.stringify(mfaMissing)).not.toContain('MFA');

    const tenantMember = await get(
      '/api/v1/platform-admin/tenants',
      'member-token',
    );
    expect(tenantMember.status).toBe(403);
    expect(bodyOf(tenantMember)).toMatchObject({
      status: 403,
      code: 'forbidden',
    });

    const memberCreate = await post(
      '/api/v1/platform-admin/tenants',
      { displayName: 'Forbidden tenant' },
      'member-token',
    );
    expect(memberCreate.status).toBe(403);
    const registry = await adminPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM tenants`,
    );
    expect(registry.rows[0]?.count).toBe(0);
  });

  it('lists tenants with minimal pagination and no database references', async () => {
    const response = await get(
      '/api/v1/platform-admin/tenants?page=1&pageSize=10',
    );
    expect(response.status).toBe(200);
    expect(bodyOf(response)).toMatchObject({ page: 1, pageSize: 10, total: 0 });
    expect(bodyOf(response).items).toEqual([]);
    expect(bodyOf(response)).not.toHaveProperty('databaseNames');
  });

  it('rejects invalid inputs before persistence', async () => {
    const oversized = await post('/api/v1/platform-admin/tenants', {
      displayName: 'x'.repeat(201),
    });
    expect(oversized.status).toBe(400);
    expect(oversized.type).toBe('application/problem+json');
    expect(bodyOf(oversized)).toMatchObject({
      code: 'validation_failed',
      status: 400,
      errors: [{ field: 'displayName', rule: 'invalid_value' }],
    });

    const selector = await patch(
      '/api/v1/platform-admin/tenants/00000000-0000-4000-8000-000000000001',
      {
        displayName: 'Tenant',
        tenant_id: 'other-tenant',
        database_name: 'sdb_x',
      },
    );
    expect(selector.status).toBe(400);
    expect(bodyOf(selector)).toMatchObject({ code: 'validation_failed' });
    expect(bodyOf(selector).errors).toEqual(
      expect.arrayContaining([
        { field: 'tenant_id', rule: 'unknown_field' },
        { field: 'database_name', rule: 'unknown_field' },
      ]),
    );

    const malformedId = await get('/api/v1/platform-admin/tenants/not-a-uuid');
    expect(malformedId.status).toBe(400);
    expect(bodyOf(malformedId)).toMatchObject({
      code: 'validation_failed',
      errors: [{ field: 'tenantId', rule: 'invalid_format' }],
    });

    const unknownTenant = await get(
      '/api/v1/platform-admin/tenants/00000000-0000-4000-8000-000000000003',
    );
    expect(unknownTenant.status).toBe(404);
    expect(bodyOf(unknownTenant)).toMatchObject({ code: 'tenant_not_found' });
    assertSecretFree(JSON.stringify(unknownTenant));
  });

  it('creates a tenant from a permanent UUID and reports metadata only', async () => {
    const response = await post('/api/v1/platform-admin/tenants', {
      displayName: 'Integration tenant',
    });
    expect(response.status).toBe(201);
    const tenantId = bodyOf(response).id as string;
    expect(tenantId).toMatch(UUID_PATTERN);
    expect(bodyOf(response)).toMatchObject({
      displayName: 'Integration tenant',
      provisioningState: 'pending',
    });
    expect(bodyOf(response).provisioning).toBeUndefined();
    assertSecretFree(JSON.stringify(response));

    const registry = await adminPool.query<{ database_name: string }>(
      `SELECT database_name FROM tenants WHERE id = $1`,
      [tenantId],
    );
    expect(registry.rows[0]?.database_name).toBe(
      `sdb_${tenantId.replaceAll('-', '')}`,
    );
    disposableNames.databases.push(registry.rows[0].database_name);
    disposableNames.roles.push(`tapp_${tenantId.replaceAll('-', '')}`);
  });

  it('updates only approved metadata and audits the change', async () => {
    const createSession = await post('/api/v1/platform-admin/tenants', {
      displayName: 'Rename tenant',
    });
    const tenantId = bodyOf(createSession).id as string;
    disposableNames.databases.push(`sdb_${tenantId.replaceAll('-', '')}`);
    disposableNames.roles.push(`tapp_${tenantId.replaceAll('-', '')}`);

    const response = await patch(`/api/v1/platform-admin/tenants/${tenantId}`, {
      displayName: 'Renamed tenant',
    });
    expect(response.status).toBe(200);
    expect(bodyOf(response)).toMatchObject({
      id: tenantId,
      displayName: 'Renamed tenant',
      provisioningState: 'pending',
    });

    const actions = await auditActions(tenantId);
    expect(actions).toContain('tenant.created');
    expect(actions).toContain('tenant.updated');
    expect(actions.every((action) => action.startsWith('tenant.'))).toBe(true);

    const unknown = await patch(
      '/api/v1/platform-admin/tenants/00000000-0000-4000-8000-000000000002',
      { displayName: 'Ghost' },
    );
    expect(unknown.status).toBe(404);
    expect(bodyOf(unknown)).toMatchObject({ code: 'tenant_not_found' });
  });

  it('provisions end-to-end and assigns the initial tenant_admin exactly once by exact issuer+subject', async () => {
    const createSession = await post('/api/v1/platform-admin/tenants', {
      displayName: 'Provisioned tenant',
    });
    const tenantId = bodyOf(createSession).id as string;
    disposableNames.databases.push(`sdb_${tenantId.replaceAll('-', '')}`);
    disposableNames.roles.push(`tapp_${tenantId.replaceAll('-', '')}`);

    // Initial membership before provisioning is refused.
    const early = await post(
      `/api/v1/platform-admin/tenants/${tenantId}/initial-admin-membership`,
      { issuer: configuredIssuer, subject: 'target-subject' },
    );
    expect(early.status).toBe(409);
    expect(bodyOf(early)).toMatchObject({ code: 'tenant_not_ready' });

    // Exactly-configured issuer is required.
    const wrongIssuer = await post(
      `/api/v1/platform-admin/tenants/${tenantId}/initial-admin-membership`,
      { issuer: 'https://other.test/realms/other', subject: 'target-subject' },
    );
    expect(wrongIssuer.status).toBe(400);
    expect(bodyOf(wrongIssuer)).toMatchObject({
      code: 'validation_failed',
      errors: [{ field: 'issuer', rule: 'unconfigured_issuer' }],
    });

    // Only local actors resolved by exact issuer+subject are enumerable.
    const missingActor = await post(
      `/api/v1/platform-admin/tenants/${tenantId}/initial-admin-membership`,
      { issuer: configuredIssuer, subject: 'no-such-subject' },
    );
    expect(missingActor.status).toBe(404);
    expect(bodyOf(missingActor)).toMatchObject({ code: 'actor_not_found' });

    // Provisioning through the CRM-02 service: database, least-priv role,
    // credential storage, tenant migrations, ready state.
    const provisioning = await post(
      `/api/v1/platform-admin/tenants/${tenantId}/provisioning`,
    );
    expect(provisioning.status).toBe(200);
    expect(bodyOf(provisioning)).toMatchObject({
      id: tenantId,
      provisioningState: 'ready',
      provisioning: { stage: 'ready', failureCode: null, attempt: 1 },
    });
    assertSecretFree(JSON.stringify(provisioning));

    expect(secretStore.records.get(tenantId)).toMatchObject({
      databaseName: `sdb_${tenantId.replaceAll('-', '')}`,
      username: `tapp_${tenantId.replaceAll('-', '')}`,
    });

    // Ready retries are idempotent no-ops.
    const retry = await post(
      `/api/v1/platform-admin/tenants/${tenantId}/provisioning`,
    );
    expect(retry.status).toBe(200);
    expect((bodyOf(retry).provisioning as { attempt: number }).attempt).toBe(1);

    // Initial tenant_admin membership: exact configured issuer + subject.
    const assigned = await post(
      `/api/v1/platform-admin/tenants/${tenantId}/initial-admin-membership`,
      { issuer: configuredIssuer, subject: 'target-subject' },
    );
    expect(assigned.status).toBe(201);
    expect(bodyOf(assigned)).toMatchObject({
      tenantId,
      role: 'tenant_admin',
      customerScope: 'both',
      status: 'active',
    });

    const memberships = await adminPool.query<{ role: string; status: string }>(
      `SELECT role, status FROM tenant_memberships WHERE tenant_id = $1`,
      [tenantId],
    );
    expect(memberships.rows).toEqual([
      { role: 'tenant_admin', status: 'active' },
    ]);

    const duplicate = await post(
      `/api/v1/platform-admin/tenants/${tenantId}/initial-admin-membership`,
      { issuer: configuredIssuer, subject: 'target-subject' },
    );
    expect(duplicate.status).toBe(409);
    expect(bodyOf(duplicate)).toMatchObject({ code: 'membership_exists' });

    const actions = await auditActions(tenantId);
    expect(actions).toContain('tenant.created');
    expect(actions).toContain('tenant.provisioning.attempt');
    expect(actions).toContain('tenant.provisioning.ready');
    expect(actions).toContain('tenant.membership.initial_admin');
    expect(
      actions.filter((action) => action === 'tenant.membership.initial_admin'),
    ).toHaveLength(1);

    const detail = await get(`/api/v1/platform-admin/tenants/${tenantId}`);
    expect(detail.status).toBe(200);
    expect(bodyOf(detail)).toMatchObject({
      id: tenantId,
      provisioningState: 'ready',
      provisioning: { stage: 'ready', failureCode: null, attempt: 1 },
    });
    expect(bodyOf(detail).visibleForAdmin).toBeUndefined();
    assertSecretFree(JSON.stringify(detail));
  });

  it('keeps CRM and tenant-database surfaces out of the manager API', async () => {
    for (const suffix of [
      'people',
      'organizations',
      'database',
      'credentials',
    ]) {
      const probe = await get(
        `/api/v1/platform-admin/tenants/00000000-0000-4000-8000-000000000004/${suffix}`,
      );
      expect(probe.status).toBe(404);
      expect(bodyOf(probe)).toMatchObject({ code: 'not_found' });
    }
  });

  it('reports provisioning failures as sanitized retryable problem details', async () => {
    const createSession = await post('/api/v1/platform-admin/tenants', {
      displayName: 'Blocked provisioning tenant',
    });
    const tenantId = bodyOf(createSession).id as string;
    disposableNames.databases.push(`sdb_${tenantId.replaceAll('-', '')}`);
    disposableNames.roles.push(`tapp_${tenantId.replaceAll('-', '')}`);

    secretStore.poisonedTenantIds.add(tenantId);
    const provisioning = await post(
      `/api/v1/platform-admin/tenants/${tenantId}/provisioning`,
    );
    expect(provisioning.status).toBe(502);
    expect(provisioning.type).toBe('application/problem+json');
    expect(bodyOf(provisioning)).toMatchObject({
      code: 'provisioning_failed',
      status: 502,
      stage: 'credential',
      failureCode: 'credential_store_failed',
    });
    expect(JSON.stringify(provisioning)).not.toContain('topsecret');
    expect(JSON.stringify(provisioning)).not.toContain('tok_val');
    expect(JSON.stringify(provisioning)).not.toContain('secretstore');
    expect(bodyOf(provisioning).requestId).toBeDefined();

    const state = await get(`/api/v1/platform-admin/tenants/${tenantId}`);
    expect(bodyOf(state).provisioningState).toBe('failed');
    expect(bodyOf(state).provisioning).toMatchObject({
      stage: 'credential',
      failureCode: 'credential_store_failed',
    });

    secretStore.poisonedTenantIds.delete(tenantId);
    // Retrying the failed tenant resumes from the durable partial state.
    const recovery = await post(
      `/api/v1/platform-admin/tenants/${tenantId}/provisioning`,
    );
    expect(recovery.status).toBe(200);
    expect(bodyOf(recovery).provisioningState).toBe('ready');
    expect((bodyOf(recovery).provisioning as { attempt: number }).attempt).toBe(
      2,
    );
  });
});
