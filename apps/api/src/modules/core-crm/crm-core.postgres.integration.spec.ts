import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { text } from 'express';
import { Pool, type PoolClient } from 'pg';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { quotePgIdentifier } from '../platform-core/control-plane/provisioning/provisioning-contracts';
import type {
  TenantDatabaseCredential,
  TenantSecretStore,
} from '../platform-core/control-plane/provisioning/tenant-secret-store';
import { IdentityTokenVerifier } from '../platform-core/identity/identity-token-verifier';
import { TenantDatabasePoolRegistry } from '../platform-core/identity/tenant-database-pool.registry';
import {
  signValidatedHost,
  VALIDATED_TENANT_HOST_HEADER,
  VALIDATED_TENANT_SIGNATURE_HEADER,
  VALIDATED_TENANT_TIME_HEADER,
} from '../platform-core/identity/trusted-ingress';
import {
  PlatformCoreModule,
  TENANT_SECRET_STORE,
} from '../platform-core/platform-core.module';
import { ManagerModule } from '../platform-core/manager/manager.module';
import { CoreCrmModule } from './core-crm.module';

const TENANT_INTEGRATION_TIMEOUT_MS = 180000;
const CONFIGURED_ISSUER = 'https://id.test/realms/syndes';
const PLATFORM_ADMIN_TOKEN = 'platform-token';
const TENANT_A = 'tenant-a.crm.test';
const TENANT_B = 'tenant-b.crm.test';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const describeIntegration = process.env.CONTROL_PLANE_DATABASE_URL
  ? describe
  : describe.skip;

/**
 * CRM-05 integration + contract proof over disposable PostgreSQL 16: the
 * full Core CRM API stack (real Control Plane identity, membership, tenant
 * context routing, guards, DTOs, audit and the CRM-02 provisioning service)
 * driven over HTTP against real per-tenant disposable databases.
 *
 * Covers the CRM-05 acceptance surface: tenant database migration from
 * zero, cross-tenant isolation (tenant B must see tenant A's records
 * nowhere, including through relationship/employee references), purpose-
 * bound server-side authorization (tenant_admin vs tenant_member), fixed
 * customer_scope (`cpf`/`pj`/`both`) person visibility and relationship /
 * employee profile semantics, plus Control Plane audit coverage for both
 * success and denied CRM actions.
 *
 * Skipped when no disposable CONTROL_PLANE_DATABASE_URL is bound locally;
 * runs inside the API CI job.
 */
describeIntegration('CRM-05 core CRM API (disposable PostgreSQL)', () => {
  let app: INestApplication;
  let adminPool: Pool;
  let tenantAPool: Pool;
  let tenantBPool: Pool;
  let tenantAdminPools: Pool[] = [];
  let secretStore: RecordingTenantSecretStore;
  const testTenantPools = new Map<string, Pool>();
  let tenantPools: Map<string, Pool>;
  const disposableNames: { databases: string[]; roles: string[] }[] = [];
  let tenantAId: string;
  let tenantBId: string;
  let actorIds: Map<string, string> = new Map();

  jest.setTimeout(TENANT_INTEGRATION_TIMEOUT_MS);

  class RecordingTenantSecretStore implements TenantSecretStore {
    readonly records = new Map<string, TenantDatabaseCredential>();

    saveTenantDatabaseCredential(
      tenantId: string,
      credential: TenantDatabaseCredential,
    ): Promise<void> {
      this.records.set(tenantId, credential);
      return Promise.resolve();
    }
  }

  class TestTenantPoolRegistry {
    constructor(private readonly pools: Map<string, Pool>) {}

    async withClient<T>(
      context: { tenantId: string },
      work: (client: PoolClient) => Promise<T>,
    ): Promise<T> {
      const pool = this.pools.get(context.tenantId);
      if (!pool) throw new Error('No disposable pool for tenant context');
      const client = await pool.connect();
      try {
        return await work(client);
      } finally {
        client.release();
      }
    }
  }

  const projectDir = process.cwd();
  const cpApplyScript = path.join(
    projectDir,
    'scripts',
    'apply-control-plane-migrations.mjs',
  );

  const actorDefinitions: Record<
    string,
    { subject: string; platformAdmin?: boolean }
  > = {
    admin: { subject: 'a-admin-subject' },
    member: { subject: 'a-member-subject' },
    cpf: { subject: 'a-cpf-subject' },
    pj: { subject: 'a-pj-subject' },
    badmin: { subject: 'b-admin-subject' },
    bpj: { subject: 'b-pj-subject' },
    platform: { subject: 'platform-admin-subject', platformAdmin: true },
  };

  function tokenFor(name: string): string {
    return `${name}-token`;
  }

  beforeAll(async () => {
    process.env.INGRESS_SIGNING_SECRET ||=
      'crm-integration-test-ingress-signing-secret';
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

    const actorValues = Object.values(actorDefinitions)
      .map(
        (actor) => `($1, '${actor.subject}', ${actor.platformAdmin === true})`,
      )
      .join(', ');
    await adminPool.query(
      `INSERT INTO identity_actors (issuer, subject, platform_admin)
       VALUES ${actorValues}`,
      [CONFIGURED_ISSUER],
    );
    const actorRows = await adminPool.query<{ subject: string; id: string }>(
      `SELECT subject, id FROM identity_actors`,
    );
    actorIds = new Map(
      actorRows.rows.map((row) => [
        Object.entries(actorDefinitions).find(
          ([, actor]) => actor.subject === row.subject,
        )?.[0] ?? row.subject,
        row.id,
      ]),
    );

    secretStore = new RecordingTenantSecretStore();

    const moduleRef = await Test.createTestingModule({
      imports: [PlatformCoreModule, ManagerModule, CoreCrmModule],
    })
      .overrideProvider(IdentityTokenVerifier)
      .useValue({
        verify: (token: string) => {
          const identities: Record<
            string,
            { issuer: string; subject: string; acr?: string }
          > = Object.fromEntries(
            Object.entries(actorDefinitions).map(([name, actor]) => [
              tokenFor(name),
              { issuer: CONFIGURED_ISSUER, subject: actor.subject, acr: 'mfa' },
            ]),
          );
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
      .useValue(CONFIGURED_ISSUER)
      .overrideProvider(TENANT_SECRET_STORE)
      .useValue(secretStore)
      .overrideProvider(TenantDatabasePoolRegistry)
      .useValue(new TestTenantPoolRegistry(testTenantPools))
      .compile();

    app = moduleRef.createNestApplication();
    app.use(text({ type: 'text/csv', limit: '10mb' }));
    await app.init();

    tenantAId = await createAndProvisionTenant('CRM Tenant A');
    tenantBId = await createAndProvisionTenant('CRM Tenant B');
    disposableNames.push({
      databases: [...secretStore.records.values()].map(
        (credential) => credential.databaseName,
      ),
      roles: [...secretStore.records.values()].map(
        (credential) => credential.username,
      ),
    });

    const controlPlaneUrl = new URL(process.env.CONTROL_PLANE_DATABASE_URL!);
    tenantPools = new Map(
      [...secretStore.records.entries()].map(([tenantId, credential]) => [
        tenantId,
        new Pool({
          host: controlPlaneUrl.hostname,
          port: Number(controlPlaneUrl.port || '5432'),
          user: credential.username,
          password: credential.password,
          database: credential.databaseName,
          max: 5,
        }),
      ]),
    );
    for (const [tenantId, pool] of tenantPools) {
      testTenantPools.set(tenantId, pool);
    }
    tenantAPool = tenantPools.get(tenantAId)!;
    tenantBPool = tenantPools.get(tenantBId)!;
    const controlPlaneUrlForCleanup = new URL(
      process.env.CONTROL_PLANE_DATABASE_URL!,
    );
    tenantAdminPools = [...secretStore.records.values()].map(
      (credential) =>
        new Pool({
          host: controlPlaneUrlForCleanup.hostname,
          port: Number(controlPlaneUrlForCleanup.port || '5432'),
          user: controlPlaneUrlForCleanup.username,
          password: controlPlaneUrlForCleanup.password || undefined,
          database: credential.databaseName,
          max: 1,
        }),
    );

    await adminPool.query(
      `INSERT INTO tenant_domains (hostname, tenant_id) VALUES ($1, $2), ($3, $4)`,
      [TENANT_A, tenantAId, TENANT_B, tenantBId],
    );

    await insertMembership(tenantAId, 'admin', 'tenant_admin', 'both');
    await insertMembership(tenantAId, 'member', 'tenant_member', 'both');
    await insertMembership(tenantAId, 'cpf', 'tenant_member', 'cpf');
    await insertMembership(tenantAId, 'pj', 'tenant_member', 'pj');
    await insertMembership(tenantBId, 'badmin', 'tenant_admin', 'both');
    await insertMembership(tenantBId, 'bpj', 'tenant_member', 'pj');
  }, TENANT_INTEGRATION_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
    if (tenantPools) {
      for (const pool of tenantPools.values()) {
        await pool.end().catch(() => undefined);
      }
    }
    await Promise.all(tenantAdminPools.map((pool) => pool.end()));
    for (const databaseName of disposableNames[0]?.databases ?? []) {
      await adminPool
        .query(
          `DROP DATABASE IF EXISTS ${quotePgIdentifier(databaseName)} WITH (FORCE)`,
        )
        .catch(() => undefined);
    }
    for (const roleName of disposableNames[0]?.roles ?? []) {
      await adminPool
        .query(`DROP ROLE IF EXISTS ${quotePgIdentifier(roleName)}`)
        .catch(() => undefined);
    }
    await adminPool?.end();
  }, TENANT_INTEGRATION_TIMEOUT_MS);

  function createAndProvisionTenant(displayName: string): Promise<string> {
    return (async () => {
      const created = await adminPost('/api/v1/platform-admin/tenants', {
        displayName,
      });
      expect(created.status).toBe(201);
      const tenantId = bodyOf(created).id as string;
      expect(tenantId).toMatch(UUID_PATTERN);
      const provisioning = await adminPost(
        `/api/v1/platform-admin/tenants/${tenantId}/provisioning`,
      );
      expect(provisioning.status).toBe(200);
      expect(bodyOf(provisioning)).toMatchObject({
        provisioningState: 'ready',
      });
      return tenantId;
    })();
  }

  function adminPost(path: string, body?: unknown) {
    const agent = request(server())
      .post(path)
      .set('authorization', `Bearer ${PLATFORM_ADMIN_TOKEN}`);
    if (typeof body !== 'undefined') {
      agent.set('content-type', 'application/json').send(body);
    }
    return agent;
  }

  async function insertMembership(
    tenantId: string,
    actorName: string,
    role: 'tenant_admin' | 'tenant_member',
    scope: 'cpf' | 'pj' | 'both',
  ): Promise<void> {
    await adminPool.query(
      `INSERT INTO tenant_memberships (tenant_id, actor_id, role, customer_scope, status)
       SELECT $1, a.id, $3, $4, 'active'
         FROM identity_actors a
         WHERE a.subject = $2`,
      [tenantId, actorDefinitions[actorName].subject, role, scope],
    );
  }

  beforeEach(async () => {
    for (const pool of tenantAdminPools) {
      // These dedicated integration databases are reset between scenarios.
      // TRUNCATE bypasses the timeline's row-level append-only trigger.
      await pool.query(`TRUNCATE TABLE
        crm_timeline_events,
        crm_notes,
        crm_channel_identities,
        crm_tag_assignments,
        crm_tags,
        crm_relationships,
        crm_employees,
        crm_people,
        crm_organizations
        RESTART IDENTITY CASCADE`);
    }
  });

  function server(): unknown {
    return app.getHttpServer();
  }

  function ingressHeaders(host: string): Record<string, string> {
    const timestamp = String(Date.now());
    return {
      [VALIDATED_TENANT_HOST_HEADER]: host,
      [VALIDATED_TENANT_TIME_HEADER]: timestamp,
      [VALIDATED_TENANT_SIGNATURE_HEADER]: signValidatedHost(
        host,
        timestamp,
        process.env.INGRESS_SIGNING_SECRET!,
      ),
    };
  }

  function get(url: string, token = 'admin-token', host: string = TENANT_A) {
    return request(server())
      .get(url)
      .set('authorization', `Bearer ${token}`)
      .set(ingressHeaders(host));
  }

  function post(
    url: string,
    body: unknown,
    token = 'admin-token',
    host: string = TENANT_A,
  ) {
    return request(server())
      .post(url)
      .set('content-type', 'application/json')
      .set('authorization', `Bearer ${token}`)
      .set(ingressHeaders(host))
      .send(body);
  }

  function patch(
    url: string,
    body: unknown,
    token = 'admin-token',
    host: string = TENANT_A,
  ) {
    return request(server())
      .patch(url)
      .set('content-type', 'application/json')
      .set('authorization', `Bearer ${token}`)
      .set(ingressHeaders(host))
      .send(body);
  }

  function del(url: string, token = 'admin-token', host: string = TENANT_A) {
    return request(server())
      .delete(url)
      .set('authorization', `Bearer ${token}`)
      .set(ingressHeaders(host));
  }

  function bodyOf(response: { text: string }): Record<string, unknown> {
    return JSON.parse(response.text) as Record<string, unknown>;
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
    ]) {
      expect(value).not.toContain(forbidden);
    }
  }

  async function auditActions(
    tenantId: string,
  ): Promise<{ action: string; result: string }[]> {
    const result = await adminPool.query<{
      action: string;
      result: string;
    }>(
      `SELECT action, result FROM audit_events
        WHERE tenant_id = $1
        ORDER BY occurred_at, action`,
      [tenantId],
    );
    return result.rows.filter((row) => row.action.startsWith('crm.'));
  }

  it('provisions both tenant databases from zero with the CRM-06 baseline', async () => {
    for (const pool of [tenantAPool, tenantBPool]) {
      const tables = await pool.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
          ORDER BY table_name`,
      );
      expect(tables.rows.map((row) => row.table_name)).toEqual([
        'crm_channel_identities',
        'crm_employees',
        'crm_notes',
        'crm_organizations',
        'crm_people',
        'crm_relationships',
        'crm_tag_assignments',
        'crm_tags',
        'crm_timeline_events',
        'tenant_baseline_info',
      ]);
    }
  });

  it('denies requests without identity, trusted routing or a tenant membership', async () => {
    const unauthenticated = await request(server())
      .get('/api/v1/crm/organizations')
      .set(ingressHeaders(TENANT_A));
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.type).toBe('application/problem+json');
    expect(bodyOf(unauthenticated)).toMatchObject({
      status: 401,
      code: 'unauthorized',
    });
    expect(bodyOf(unauthenticated).requestId).toBeDefined();
    assertSecretFree(unauthenticated.text);

    const unrouted = await request(server())
      .get('/api/v1/crm/organizations')
      .set('authorization', `Bearer ${tokenFor('member')}`);
    expect(unrouted.status).toBe(404);
    expect(bodyOf(unrouted)).toMatchObject({ code: 'not_found' });

    const unsigned = await request(server())
      .get('/api/v1/crm/organizations')
      .set('authorization', `Bearer ${tokenFor('member')}`)
      .set(VALIDATED_TENANT_HOST_HEADER, TENANT_A)
      .set(VALIDATED_TENANT_TIME_HEADER, String(Date.now()));
    expect(unsigned.status).toBe(404);
    expect(bodyOf(unsigned)).toMatchObject({ code: 'not_found' });

    const unknownHost = await get(
      '/api/v1/crm/organizations',
      tokenFor('member'),
      'tenant-unknown.crm.test',
    );
    expect(unknownHost.status).toBe(404);
    expect(bodyOf(unknownHost)).toMatchObject({ code: 'not_found' });

    const platformAdmin = await request(server())
      .get('/api/v1/crm/organizations')
      .set('authorization', `Bearer ${PLATFORM_ADMIN_TOKEN}`);
    expect(platformAdmin.status).toBe(404);
    expect(bodyOf(platformAdmin)).toMatchObject({ code: 'not_found' });

    const selector = await post('/api/v1/crm/organizations', {
      name: 'Routed by the client',
      tenant_id: 'some-other-tenant',
      database_name: 'sdb_x',
    });
    expect(selector.status).toBe(400);
    expect(bodyOf(selector)).toMatchObject({ code: 'bad_request' });
    assertSecretFree(selector.text);
  });

  it('manages the organization lifecycle with soft archive and conflict safety', async () => {
    const created = await post('/api/v1/crm/organizations', {
      name: 'Organização Alfa',
      cnpj: '12.345.678/0001-00',
      email: 'contato@alfa.test',
      phone: '+55 11 4000-0000',
    });
    expect(created.status).toBe(201);
    const organizationId = bodyOf(created).id as string;
    expect(organizationId).toMatch(UUID_PATTERN);
    expect(bodyOf(created)).toMatchObject({
      name: 'Organização Alfa',
      cnpj: '12.345.678/0001-00',
      archivedAt: null,
    });
    assertSecretFree(created.text);

    const duplicate = await post('/api/v1/crm/organizations', {
      name: 'Outra Alfa',
      cnpj: '12.345.678/0001-00',
    });
    expect(duplicate.status).toBe(409);
    expect(bodyOf(duplicate)).toMatchObject({
      code: 'organization_cnpj_conflict',
    });

    const detail = await get(`/api/v1/crm/organizations/${organizationId}`);
    expect(detail.status).toBe(200);
    expect(bodyOf(detail).id).toBe(organizationId);

    const updated = await patch(`/api/v1/crm/organizations/${organizationId}`, {
      name: 'Organização Alfa Renomeada',
    });
    expect(updated.status).toBe(200);
    expect(bodyOf(updated)).toMatchObject({
      name: 'Organização Alfa Renomeada',
    });

    const list = await get('/api/v1/crm/organizations?page=1&pageSize=10');
    expect(list.status).toBe(200);
    expect(bodyOf(list)).toMatchObject({ page: 1, pageSize: 10, total: 1 });
    expect((bodyOf(list).items as Record<string, unknown>[]).length).toBe(1);

    const archived = await del(`/api/v1/crm/organizations/${organizationId}`);
    expect(archived.status).toBe(200);
    expect(String(bodyOf(archived).archivedAt)).toMatch(/\d{4}-\d{2}-\d{2}/);
    assertSecretFree(archived.text);

    const detailAfter = await get(
      `/api/v1/crm/organizations/${organizationId}`,
    );
    expect(detailAfter.status).toBe(200);
    expect(String(bodyOf(detailAfter).archivedAt)).toMatch(/\d{4}-\d{2}-\d{2}/);

    const listAfter = await get('/api/v1/crm/organizations');
    expect(bodyOf(listAfter).total).toBe(0);

    const updateArchived = await patch(
      `/api/v1/crm/organizations/${organizationId}`,
      { name: 'Zombie' },
    );
    expect(updateArchived.status).toBe(409);
    expect(bodyOf(updateArchived)).toMatchObject({ code: 'resource_archived' });

    const archiveAgain = await del(
      `/api/v1/crm/organizations/${organizationId}`,
    );
    expect(archiveAgain.status).toBe(200);

    const unknown = await get(
      '/api/v1/crm/organizations/00000000-0000-4000-8000-000000000001',
    );
    expect(unknown.status).toBe(404);
    expect(bodyOf(unknown)).toMatchObject({ code: 'organization_not_found' });

    const malformed = await get('/api/v1/crm/organizations/not-a-uuid');
    expect(malformed.status).toBe(400);
    expect(bodyOf(malformed)).toMatchObject({
      code: 'validation_failed',
      errors: [{ field: 'organizationId', rule: 'invalid_format' }],
    });
  });

  it('validates organization, person, relationship and employee input before persistence', async () => {
    const oversized = await post('/api/v1/crm/organizations', {
      name: 'x'.repeat(201),
    });
    expect(oversized.status).toBe(400);
    expect(bodyOf(oversized)).toMatchObject({
      code: 'validation_failed',
      errors: [{ field: 'name', rule: 'invalid_value' }],
    });

    const unknownFields = await post('/api/v1/crm/organizations', {
      name: 'Org',
      tags: 'extra',
    });
    expect(unknownFields.status).toBe(400);
    expect(bodyOf(unknownFields)).toMatchObject({
      errors: [{ field: 'tags', rule: 'unknown_field' }],
    });

    const badEmail = await post('/api/v1/crm/organizations', {
      name: 'Org',
      email: 'not-an-email',
    });
    expect(badEmail.status).toBe(400);
    expect(bodyOf(badEmail)).toMatchObject({
      errors: [{ field: 'email', rule: 'invalid_format' }],
    });

    const emptyPatch = await patch(
      `/api/v1/crm/organizations/${'00000000-0000-4000-8000-000000000002'}`,
      {},
    );
    expect(emptyPatch.status).toBe(400);
    expect(bodyOf(emptyPatch)).toMatchObject({
      errors: [{ field: 'body', rule: 'no_fields' }],
    });

    const badPerson = await post('/api/v1/crm/people', {
      fullName: 'Ana',
      cpf: 'a'.repeat(200),
    });
    expect(badPerson.status).toBe(400);
    expect(bodyOf(badPerson)).toMatchObject({ code: 'validation_failed' });

    const badRelationship = await post('/api/v1/crm/relationships', {
      personId: 'nope',
      organizationId: 'nope',
    });
    expect(badRelationship.status).toBe(400);
    expect(
      (bodyOf(badRelationship).errors as { field: string }[]).map(
        (error) => error.field,
      ),
    ).toEqual(expect.arrayContaining(['personId', 'organizationId']));

    const employeeCredential = await post('/api/v1/crm/employees', {
      displayName: 'Atendente',
      password: 'attempted-password',
    });
    expect(employeeCredential.status).toBe(400);
    expect(bodyOf(employeeCredential)).toMatchObject({
      errors: [{ field: 'password', rule: 'unknown_field' }],
    });
    expect(JSON.stringify(employeeCredential.text)).not.toContain(
      'attempted-password',
    );
  });

  it('applies customer_scope person visibility server-side', async () => {
    const organization = await post('/api/v1/crm/organizations', {
      name: 'Org Visível PJ',
    });
    expect(organization.status).toBe(201);
    const organizationId = bodyOf(organization).id as string;

    const unlinked = await post('/api/v1/crm/people', {
      fullName: 'Ana Sem Vínculo',
      cpf: '123.456.789-00',
    });
    expect(unlinked.status).toBe(201);
    const unlinkedId = bodyOf(unlinked).id as string;
    const linked = await post('/api/v1/crm/people', {
      fullName: 'Bruno Contato PJ',
      organizationId,
    });
    expect(linked.status).toBe(201);
    const linkedId = bodyOf(linked).id as string;

    const cpfList = await get('/api/v1/crm/people', tokenFor('cpf'));
    expect(cpfList.status).toBe(200);
    expect(
      (bodyOf(cpfList).items as { id: string }[]).map((item) => item.id),
    ).toEqual([unlinkedId]);

    const pfDetail = await get(
      `/api/v1/crm/people/${linkedId}`,
      tokenFor('cpf'),
    );
    expect(pfDetail.status).toBe(404);
    expect(bodyOf(pfDetail)).toMatchObject({ code: 'person_not_found' });

    const pfOrganizationDetail = await get(
      `/api/v1/crm/organizations/${organizationId}`,
      tokenFor('cpf'),
    );
    expect(pfOrganizationDetail.status).toBe(403);
    expect(bodyOf(pfOrganizationDetail)).toMatchObject({
      code: 'scope_denied',
    });
    expect(pfOrganizationDetail.type).toBe('application/problem+json');

    const pjList = await get('/api/v1/crm/people', tokenFor('pj'));
    expect(pjList.status).toBe(200);
    expect(
      (bodyOf(pjList).items as { id: string }[]).map((item) => item.id),
    ).toEqual([linkedId]);

    const pjDetail = await get(
      `/api/v1/crm/people/${unlinkedId}`,
      tokenFor('pj'),
    );
    expect(pjDetail.status).toBe(404);
    expect(pjDetail.type).toBe('application/problem+json');

    const bothList = await get('/api/v1/crm/people', tokenFor('member'));
    expect(bothList.status).toBe(200);
    expect((bodyOf(bothList).items as { id: string }[]).length).toBe(2);

    const adminList = await get('/api/v1/crm/people');
    expect(adminList.status).toBe(200);
    expect((bodyOf(adminList).items as { id: string }[]).length).toBe(2);
  });

  it('guards organization and relationship surfaces for cpf-scoped members', async () => {
    const organizationCountBefore = await tenantAPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM crm_organizations`,
    );
    const personCountBefore = await tenantAPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM crm_people`,
    );
    const listAttempt = await get('/api/v1/crm/organizations', tokenFor('cpf'));
    expect(listAttempt.status).toBe(403);
    expect(bodyOf(listAttempt)).toMatchObject({ code: 'scope_denied' });

    const createAttempt = await post(
      '/api/v1/crm/organizations',
      { name: 'Denied Org' },
      tokenFor('cpf'),
    );
    expect(createAttempt.status).toBe(403);
    expect(bodyOf(createAttempt)).toMatchObject({ code: 'scope_denied' });

    const relationshipAttempt = await post(
      '/api/v1/crm/relationships',
      {
        personId: '00000000-0000-4000-8000-000000000001',
        organizationId: '00000000-0000-4000-8000-000000000002',
      },
      tokenFor('cpf'),
    );
    expect(relationshipAttempt.status).toBe(403);
    expect(bodyOf(relationshipAttempt)).toMatchObject({ code: 'scope_denied' });

    const denied = await auditActions(tenantAId);
    const deniedCodes = denied.filter((entry) => entry.result === 'denied');
    expect(deniedCodes).toEqual(
      expect.arrayContaining([
        { action: 'crm.organization.access.denied', result: 'denied' },
        { action: 'crm.relationship.access.denied', result: 'denied' },
      ]),
    );

    const organizations = await tenantAPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM crm_organizations`,
    );
    const people = await tenantAPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM crm_people`,
    );
    expect(organizations.rows[0]?.count).toBe(
      organizationCountBefore.rows[0]?.count,
    );
    expect(people.rows[0]?.count).toBe(personCountBefore.rows[0]?.count);
  });

  it('keeps person creation scope-bound and archive admin-only', async () => {
    const organization = await post('/api/v1/crm/organizations', {
      name: 'Org PJ do Membro',
    });
    const organizationId = bodyOf(organization).id as string;

    const pjUnlinked = await post(
      '/api/v1/crm/people',
      { fullName: 'Contato Solto' },
      tokenFor('pj'),
    );
    expect(pjUnlinked.status).toBe(403);
    expect(bodyOf(pjUnlinked)).toMatchObject({ code: 'scope_denied' });

    const pjLinked = await post(
      '/api/v1/crm/people',
      { fullName: 'Contato PJ', organizationId },
      tokenFor('pj'),
    );
    expect(pjLinked.status).toBe(201);
    const linkedPersonId = bodyOf(pjLinked).id as string;
    expect(bodyOf(pjLinked)).toMatchObject({
      fullName: 'Contato PJ',
      organizationId,
    });

    const bothUnlinked = await post(
      '/api/v1/crm/people',
      { fullName: 'Livre' },
      tokenFor('member'),
    );
    expect(bothUnlinked.status).toBe(201);

    const ghostLink = await post(
      '/api/v1/crm/relationships',
      {
        personId: '00000000-0000-4000-8000-000000000010',
        organizationId,
      },
      tokenFor('pj'),
    );
    expect(ghostLink.status).toBe(404);
    expect(bodyOf(ghostLink)).toMatchObject({ code: 'person_not_found' });

    const memberRemove = await del(
      `/api/v1/crm/relationships/${linkedPersonId}/${organizationId}`,
      tokenFor('pj'),
    );
    expect(memberRemove.status).toBe(200);

    const memberArchive = await del(
      `/api/v1/crm/people/${linkedPersonId}`,
      tokenFor('pj'),
    );
    expect(memberArchive.status).toBe(403);
    expect(bodyOf(memberArchive)).toMatchObject({ code: 'forbidden' });
    expect(memberArchive.type).toBe('application/problem+json');

    const denied = await auditActions(tenantAId);
    const deniedActions = denied
      .filter((entry) => entry.result === 'denied')
      .map((entry) => entry.action);
    expect(deniedActions).toEqual(
      expect.arrayContaining([
        'crm.person.archive.denied',
        'crm.person.create.denied',
      ]),
    );

    const adminArchive = await del(`/api/v1/crm/people/${linkedPersonId}`);
    expect(adminArchive.status).toBe(200);
    expect(String(bodyOf(adminArchive).archivedAt)).toMatch(/\d{4}-\d{2}/);
  });

  it('rejects updates to archived persons with the stable archive conflict', async () => {
    const person = await post('/api/v1/crm/people', {
      fullName: 'Pessoa Arquivada',
      email: 'arquivada@example.com',
    });
    expect(person.status).toBe(201);
    const personId = bodyOf(person).id as string;
    const before = await tenantAPool.query<{
      full_name: string;
      email: string;
      updated_at: string;
      archived_at: string;
    }>(
      `SELECT full_name, email, updated_at, archived_at FROM crm_people WHERE id = $1`,
      [personId],
    );
    expect(before.rows[0]?.archived_at).toBeNull();

    const archive = await del(`/api/v1/crm/people/${personId}`);
    expect(archive.status).toBe(200);
    expect(String(bodyOf(archive).archivedAt)).toMatch(/\d{4}-\d{2}/);

    const archivedPatch = await patch(`/api/v1/crm/people/${personId}`, {
      fullName: 'Zumbi Editável',
      email: 'zumbi@example.com',
    });
    expect(archivedPatch.status).toBe(409);
    expect(bodyOf(archivedPatch)).toMatchObject({ code: 'resource_archived' });
    expect(archivedPatch.type).toBe('application/problem+json');

    const afterPatch = await tenantAPool.query<{
      full_name: string;
      email: string;
      updated_at: string;
    }>(`SELECT full_name, email, updated_at FROM crm_people WHERE id = $1`, [
      personId,
    ]);
    expect(afterPatch.rows[0]?.full_name).toBe(before.rows[0]?.full_name);
    expect(afterPatch.rows[0]?.email).toBe(before.rows[0]?.email);
    expect(afterPatch.rows[0]?.updated_at).toEqual(before.rows[0]?.updated_at);

    const detailAfter = await get(`/api/v1/crm/people/${personId}`);
    expect(detailAfter.status).toBe(200);
    expect(bodyOf(detailAfter)).toMatchObject({
      fullName: 'Pessoa Arquivada',
      email: 'arquivada@example.com',
    });
    expect(String(bodyOf(detailAfter).archivedAt)).toMatch(/\d{4}-\d{2}/);
  });

  it('manages relationships with existence, archive and duplicate guarantees', async () => {
    const organization = await post('/api/v1/crm/organizations', {
      name: 'Org Relacionamento',
    });
    const organizationId = bodyOf(organization).id as string;
    const person = await post('/api/v1/crm/people', {
      fullName: 'Pessoa Relacionada',
      organizationId,
    });
    const personId = bodyOf(person).id as string;
    const cpfOnlyPerson = await post('/api/v1/crm/people', {
      fullName: 'Pessoa sem vínculo PJ',
    });
    const scopeBypassAttempt = await post(
      '/api/v1/crm/relationships',
      {
        personId: bodyOf(cpfOnlyPerson).id,
        organizationId,
      },
      tokenFor('pj'),
    );
    expect(scopeBypassAttempt.status).toBe(404);
    expect(bodyOf(scopeBypassAttempt)).toMatchObject({
      code: 'person_not_found',
    });

    const duplicate = await post('/api/v1/crm/relationships', {
      personId,
      organizationId,
    });
    expect(duplicate.status).toBe(409);
    expect(bodyOf(duplicate)).toMatchObject({
      code: 'relationship_exists_conflict',
    });

    const detail = await get(
      `/api/v1/crm/relationships/${personId}/${organizationId}`,
    );
    expect(detail.status).toBe(200);
    expect(bodyOf(detail)).toMatchObject({ role: 'contact' });

    const unknownOrganization = await post('/api/v1/crm/relationships', {
      personId,
      organizationId: '00000000-0000-4000-8000-000000000005',
    });
    expect(unknownOrganization.status).toBe(404);
    expect(bodyOf(unknownOrganization)).toMatchObject({
      code: 'organization_not_found',
    });

    const removed = await del(
      `/api/v1/crm/relationships/${personId}/${organizationId}`,
    );
    expect(removed.status).toBe(200);
    const afterRemove = await get(
      `/api/v1/crm/relationships/${personId}/${organizationId}`,
    );
    expect(afterRemove.status).toBe(404);

    await post('/api/v1/crm/relationships', { personId, organizationId });
    await del(`/api/v1/crm/people/${personId}`);
    const linkArchivedPerson = await post('/api/v1/crm/relationships', {
      personId,
      organizationId,
    });
    expect(linkArchivedPerson.status).toBe(409);
    expect(bodyOf(linkArchivedPerson)).toMatchObject({
      code: 'resource_archived',
    });

    const finalRemove = await del(
      `/api/v1/crm/relationships/${personId}/${organizationId}`,
    );
    expect(finalRemove.status).toBe(200);
    const secondRemove = await del(
      `/api/v1/crm/relationships/${personId}/${organizationId}`,
    );
    expect(secondRemove.status).toBe(404);

    const actions = (await auditActions(tenantAId)).map(
      (entry) => entry.action,
    );
    expect(actions).toEqual(
      expect.arrayContaining([
        'crm.person.created',
        'crm.person.archived',
        'crm.relationship.created',
        'crm.relationship.removed',
      ]),
    );
  });

  it('keeps tenant B unable to access or reference tenant A records', async () => {
    const organization = await post('/api/v1/crm/organizations', {
      name: 'Org Confidencial A',
    });
    const tenantAOrganizationId = bodyOf(organization).id as string;
    const person = await post('/api/v1/crm/people', {
      fullName: 'Pessoa Confidencial A',
    });
    const tenantAPersonId = bodyOf(person).id as string;
    const countBeforeCrossTenantAttempts = await tenantAPool.query<{
      count: number;
    }>(`SELECT count(*)::int AS count FROM crm_organizations`);

    const detail = await get(
      `/api/v1/crm/organizations/${tenantAOrganizationId}`,
      tokenFor('badmin'),
      TENANT_B,
    );
    expect(detail.status).toBe(404);
    expect(bodyOf(detail)).toMatchObject({ code: 'organization_not_found' });

    const update = await patch(
      `/api/v1/crm/organizations/${tenantAOrganizationId}`,
      { name: 'Exfiltração' },
      tokenFor('badmin'),
      TENANT_B,
    );
    expect(update.status).toBe(404);

    const remove = await del(
      `/api/v1/crm/organizations/${tenantAOrganizationId}`,
      tokenFor('badmin'),
      TENANT_B,
    );
    expect(remove.status).toBe(404);

    const personDetail = await get(
      `/api/v1/crm/people/${tenantAPersonId}`,
      tokenFor('badmin'),
      TENANT_B,
    );
    expect(personDetail.status).toBe(404);

    const link = await post(
      '/api/v1/crm/relationships',
      {
        personId: tenantAPersonId,
        organizationId: tenantAOrganizationId,
      },
      tokenFor('badmin'),
      TENANT_B,
    );
    expect(link.status).toBe(404);
    expect(bodyOf(link)).toMatchObject({ code: 'organization_not_found' });

    const crossList = await get(
      '/api/v1/crm/people',
      tokenFor('badmin'),
      TENANT_B,
    );
    expect(crossList.status).toBe(200);
    expect((bodyOf(crossList).items as unknown[]).length).toBe(0);
    const countA = await tenantAPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM crm_organizations`,
    );
    expect(countA.rows[0]?.count).toBe(
      countBeforeCrossTenantAttempts.rows[0]?.count,
    );

    // The rejected cross-tenant attempts leave no CRM audit trail anywhere.
    const tenantBCrmAudit = await adminPool.query<{ action: string }>(
      `SELECT action FROM audit_events WHERE tenant_id = $1 AND action LIKE 'crm.%'`,
      [tenantBId],
    );
    expect(tenantBCrmAudit.rows).toEqual([]);
  });

  it('manages employee staff profiles with admin-only writes and actor linkage', async () => {
    const first = await post('/api/v1/crm/employees', {
      displayName: 'Atendente Um',
    });
    expect(first.status).toBe(201);
    const firstId = bodyOf(first).id as string;
    expect(bodyOf(first)).toMatchObject({
      displayName: 'Atendente Um',
      active: true,
      controlPlaneActorId: null,
    });
    expect(bodyOf(first)).not.toHaveProperty('password');
    expect(bodyOf(first)).not.toHaveProperty('credentials');
    assertSecretFree(first.text);

    const memberActorId = actorIds.get('member')!;
    const linked = await post('/api/v1/crm/employees', {
      displayName: 'Atendente Vinculado',
      controlPlaneActorId: memberActorId,
    });
    expect(linked.status).toBe(201);
    expect(bodyOf(linked)).toMatchObject({
      controlPlaneActorId: memberActorId,
    });

    const duplicate = await post('/api/v1/crm/employees', {
      displayName: 'Atendente Duplicado',
      controlPlaneActorId: memberActorId,
    });
    expect(duplicate.status).toBe(409);
    expect(bodyOf(duplicate)).toMatchObject({
      code: 'employee_actor_conflict',
    });

    const unknownActor = await post('/api/v1/crm/employees', {
      displayName: 'Atendente Fantasma',
      controlPlaneActorId: '00000000-0000-4000-8000-000000000009',
    });
    expect(unknownActor.status).toBe(404);
    expect(bodyOf(unknownActor)).toMatchObject({ code: 'actor_not_found' });

    const memberList = await get('/api/v1/crm/employees', tokenFor('pj'));
    expect(memberList.status).toBe(200);
    expect((bodyOf(memberList).items as unknown[]).length).toBe(2);

    const memberCreate = await post(
      '/api/v1/crm/employees',
      { displayName: 'Atendente Não Autorizado' },
      tokenFor('pj'),
    );
    expect(memberCreate.status).toBe(403);
    expect(bodyOf(memberCreate)).toMatchObject({ code: 'forbidden' });

    const memberPatch = await patch(
      `/api/v1/crm/employees/${firstId}`,
      { active: false },
      tokenFor('member'),
    );
    expect(memberPatch.status).toBe(403);
    expect(bodyOf(memberPatch)).toMatchObject({ code: 'forbidden' });

    const deactivated = await patch(`/api/v1/crm/employees/${firstId}`, {
      active: false,
    });
    expect(deactivated.status).toBe(200);
    expect(bodyOf(deactivated)).toMatchObject({ active: false });

    const denied = await auditActions(tenantAId);
    const deniedActions = denied
      .filter((entry) => entry.result === 'denied')
      .map((entry) => entry.action);
    expect(deniedActions).toEqual(
      expect.arrayContaining(['crm.employee.manage.denied']),
    );

    const unknown = await get(
      '/api/v1/crm/employees/00000000-0000-4000-8000-000000000008',
      tokenFor('member'),
    );
    expect(unknown.status).toBe(404);
    expect(bodyOf(unknown)).toMatchObject({ code: 'employee_not_found' });
  });

  it('audits organization mutations and denied operations to the Control Plane', async () => {
    const organization = await post('/api/v1/crm/organizations', {
      name: 'Organização Auditada',
    });
    const organizationId = bodyOf(organization).id as string;
    await patch(`/api/v1/crm/organizations/${organizationId}`, {
      email: 'audit@alfa.test',
    });
    await del(`/api/v1/crm/organizations/${organizationId}`, tokenFor('pj'));
    await del(`/api/v1/crm/organizations/${organizationId}`);

    const actions = await auditActions(tenantAId);
    const actionNames = actions.map((entry) => entry.action);
    expect(actionNames).toEqual(
      expect.arrayContaining([
        'crm.organization.created',
        'crm.organization.updated',
        'crm.organization.archive.denied',
        'crm.organization.archived',
      ]),
    );
    for (const denied of actions.filter((entry) => entry.result === 'denied')) {
      expect(denied.action.endsWith('.denied')).toBe(true);
    }
    for (const success of actions.filter(
      (entry) => entry.result === 'success',
    )) {
      expect(success.action.startsWith('crm.')).toBe(true);
      expect(success.action.endsWith('.denied')).toBe(false);
    }
  });

  it('keeps tags, notes, channel metadata and timeline scope-bound and atomic', async () => {
    const organization = await post('/api/v1/crm/organizations', {
      name: 'CRM-06 PJ target',
    });
    const organizationId = bodyOf(organization).id as string;
    const person = await post('/api/v1/crm/people', {
      fullName: 'Nome confirmado no CRM',
      organizationId,
    });
    const personId = bodyOf(person).id as string;

    const tag = await post('/api/v1/crm/tags', {
      name: 'VIP',
      color: '#123abc',
    });
    expect(tag.status).toBe(201);
    const tagId = bodyOf(tag).id as string;
    expect(
      (
        await request(server())
          .put(`/api/v1/crm/tags/${tagId}/people/${personId}`)
          .set(ingressHeaders(TENANT_A))
          .set('Authorization', `Bearer ${tokenFor('admin')}`)
      ).status,
    ).toBe(200);
    const note = await post('/api/v1/crm/notes', {
      personId,
      body: 'Retornar na sexta',
    });
    expect(note.status).toBe(201);
    expect(
      (await get(`/api/v1/crm/notes?personId=${personId}`, tokenFor('pj')))
        .status,
    ).toBe(200);

    const identity = await request(server())
      .put(`/api/v1/crm/people/${personId}/channel-identities`)
      .set(ingressHeaders(TENANT_A))
      .set('Authorization', `Bearer ${tokenFor('admin')}`)
      .send({
        channel: 'whatsapp',
        externalId: 'wa-contact-1',
        pushName: 'Nome do WhatsApp',
      });
    expect(identity.status).toBe(200);
    const otherPerson = await post('/api/v1/crm/people', {
      fullName: 'Outra pessoa CRM',
    });
    const identityReassignment = await request(server())
      .put(
        `/api/v1/crm/people/${bodyOf(otherPerson).id as string}/channel-identities`,
      )
      .set(ingressHeaders(TENANT_A))
      .set('Authorization', `Bearer ${tokenFor('admin')}`)
      .send({
        channel: 'whatsapp',
        externalId: 'wa-contact-1',
        pushName: 'Tentativa de reassociação',
      });
    expect(identityReassignment.status).toBe(409);
    expect(bodyOf(identityReassignment)).toMatchObject({
      code: 'channel_identity_conflict',
    });
    const unchangedPerson = await get(`/api/v1/crm/people/${personId}`);
    expect(bodyOf(unchangedPerson).fullName).toBe('Nome confirmado no CRM');

    const scopedDetach = await del(
      `/api/v1/crm/tags/${tagId}/people/${personId}`,
      tokenFor('cpf'),
    );
    expect(scopedDetach.status).toBe(404);
    expect(bodyOf(scopedDetach)).toMatchObject({ code: 'person_not_found' });
    const detached = await del(`/api/v1/crm/tags/${tagId}/people/${personId}`);
    expect(detached.status).toBe(200);

    await patch(`/api/v1/crm/people/${personId}`, {
      fullName: 'Nome atualizado',
    });
    const timeline = await get(
      `/api/v1/crm/people/${personId}/timeline`,
      tokenFor('pj'),
    );
    expect(timeline.status).toBe(200);
    expect(
      (bodyOf(timeline).items as { kind: string }[]).map((event) => event.kind),
    ).toEqual(
      expect.arrayContaining([
        'person.created',
        'relationship.created',
        'note.created',
        'person.updated',
        'tag.attached',
        'tag.detached',
      ]),
    );
    const attributedEvent = await tenantAPool.query<{
      id: string;
      actor_id: string;
    }>(
      `SELECT id::text, actor_id::text FROM crm_timeline_events
       WHERE person_id = $1 AND event_kind = 'person.created'`,
      [personId],
    );
    expect(attributedEvent.rows[0]?.actor_id).toBe(actorIds.get('admin'));
    const eventId = attributedEvent.rows[0].id;
    await expect(
      tenantAPool.query(
        `UPDATE crm_timeline_events SET event_kind = 'person.updated' WHERE id = $1`,
        [eventId],
      ),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      tenantAPool.query(`DELETE FROM crm_timeline_events WHERE id = $1`, [
        eventId,
      ]),
    ).rejects.toMatchObject({ code: '23514' });

    const organizationTimeline = await get(
      `/api/v1/crm/organizations/${organizationId}/timeline`,
      tokenFor('pj'),
    );
    expect(
      (bodyOf(organizationTimeline).items as { kind: string }[]).map(
        (event) => event.kind,
      ),
    ).toContain('relationship.created');
    const forbiddenTimeline = await get(
      `/api/v1/crm/organizations/${organizationId}/timeline`,
      tokenFor('cpf'),
    );
    expect(forbiddenTimeline.status).toBe(403);

    await del(`/api/v1/crm/relationships/${personId}/${organizationId}`);
    const afterRemoval = await get(`/api/v1/crm/people/${personId}/timeline`);
    expect(
      (bodyOf(afterRemoval).items as { kind: string }[]).map(
        (event) => event.kind,
      ),
    ).toContain('relationship.removed');
    const archived = await del(`/api/v1/crm/people/${personId}`);
    expect(archived.status).toBe(200);
    const afterArchive = await get(`/api/v1/crm/people/${personId}/timeline`);
    expect(
      (bodyOf(afterArchive).items as { kind: string }[]).map(
        (event) => event.kind,
      ),
    ).toContain('person.archived');
  });

  it('captures every CRM-06 supporting mutation in its tenant transaction', async () => {
    const organization = await post('/api/v1/crm/organizations', {
      name: 'Org Todos os Eventos',
    });
    expect(organization.status).toBe(201);
    const organizationId = bodyOf(organization).id as string;

    const person = await post('/api/v1/crm/people', {
      fullName: 'Pessoa Eventos',
      organizationId,
    });
    expect(person.status).toBe(201);
    const personId = bodyOf(person).id as string;

    const tag = await post('/api/v1/crm/tags', {
      name: 'Evento',
      color: '#abc123',
    });
    expect(tag.status).toBe(201);
    const tagId = bodyOf(tag).id as string;

    const attached = await request(server())
      .put(`/api/v1/crm/tags/${tagId}/organizations/${organizationId}`)
      .set(ingressHeaders(TENANT_A))
      .set('Authorization', `Bearer ${tokenFor('admin')}`);
    expect(attached.status).toBe(200);

    const note = await post('/api/v1/crm/notes', {
      organizationId,
      body: 'Nota sobre a organização',
    });
    expect(note.status).toBe(201);

    const updated = await patch(`/api/v1/crm/organizations/${organizationId}`, {
      email: 'todos@eventos.test',
    });
    expect(updated.status).toBe(200);

    const archived = await del(`/api/v1/crm/organizations/${organizationId}`);
    expect(archived.status).toBe(200);

    const orgEvents = await tenantAPool.query<{
      event_kind: string;
      actor_id: string;
    }>(
      `SELECT event_kind, actor_id::text FROM crm_timeline_events
       WHERE organization_id = $1
       ORDER BY occurred_at ASC, id ASC`,
      [organizationId],
    );
    const orgKinds = orgEvents.rows.map((row) => row.event_kind);
    expect(orgKinds).toEqual(
      expect.arrayContaining([
        'organization.created',
        'relationship.created',
        'tag.attached',
        'note.created',
        'organization.updated',
        'organization.archived',
      ]),
    );
    const createdEvent = orgEvents.rows.find(
      (row) => row.event_kind === 'organization.created',
    );
    expect(createdEvent?.actor_id).toBe(actorIds.get('admin'));

    const personEvents = await tenantAPool.query<{ event_kind: string }>(
      `SELECT event_kind FROM crm_timeline_events WHERE person_id = $1`,
      [personId],
    );
    expect(personEvents.rows.map((row) => row.event_kind)).toEqual(
      expect.arrayContaining(['person.created', 'relationship.created']),
    );
  });

  it('leaves no timeline event or row when a supporting mutation fails', async () => {
    const archivedOrg = await post('/api/v1/crm/organizations', {
      name: 'Org Arquivada',
    });
    expect(archivedOrg.status).toBe(201);
    const archivedOrgId = bodyOf(archivedOrg).id as string;
    await del(`/api/v1/crm/organizations/${archivedOrgId}`);

    const failedPerson = await post('/api/v1/crm/people', {
      fullName: 'Não Deve Existir',
      organizationId: archivedOrgId,
    });
    expect(failedPerson.status).toBe(409);
    expect(bodyOf(failedPerson)).toMatchObject({ code: 'resource_archived' });

    const personRows = await tenantAPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM crm_people WHERE full_name = $1`,
      ['Não Deve Existir'],
    );
    expect(personRows.rows[0]?.count).toBe(0);
    const personEvents = await tenantAPool.query<{ event_kind: string }>(
      `SELECT event_kind FROM crm_timeline_events
       WHERE person_id IN (SELECT id FROM crm_people WHERE full_name = $1)`,
      ['Não Deve Existir'],
    );
    expect(personEvents.rows).toEqual([]);

    const person = await post('/api/v1/crm/people', { fullName: 'Viva' });
    expect(person.status).toBe(201);
    const personId = bodyOf(person).id as string;
    const tag = await post('/api/v1/crm/tags', { name: 'Não Deve Anexar' });
    expect(tag.status).toBe(201);
    const tagId = bodyOf(tag).id as string;
    await del(`/api/v1/crm/people/${personId}`);

    const failedAttach = await request(server())
      .put(`/api/v1/crm/tags/${tagId}/people/${personId}`)
      .set(ingressHeaders(TENANT_A))
      .set('Authorization', `Bearer ${tokenFor('admin')}`);
    expect(failedAttach.status).toBe(409);
    expect(bodyOf(failedAttach)).toMatchObject({ code: 'resource_archived' });

    const assignmentEvents = await tenantAPool.query<{ event_kind: string }>(
      `SELECT event_kind FROM crm_timeline_events WHERE tag_id = $1`,
      [tagId],
    );
    expect(assignmentEvents.rows).toEqual([]);
    const assignments = await tenantAPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM crm_tag_assignments WHERE tag_id = $1`,
      [tagId],
    );
    expect(assignments.rows[0]?.count).toBe(0);
  });

  it('keeps tenant B unable to read or alter tenant A tags, notes, channel identities and timeline', async () => {
    const organization = await post('/api/v1/crm/organizations', {
      name: 'Org Secreta A',
    });
    expect(organization.status).toBe(201);
    const organizationId = bodyOf(organization).id as string;
    const person = await post('/api/v1/crm/people', {
      fullName: 'Pessoa Secreta A',
      organizationId,
    });
    expect(person.status).toBe(201);
    const personId = bodyOf(person).id as string;

    const tag = await post('/api/v1/crm/tags', { name: 'Secreto' });
    expect(tag.status).toBe(201);
    const tagId = bodyOf(tag).id as string;
    await request(server())
      .put(`/api/v1/crm/tags/${tagId}/people/${personId}`)
      .set(ingressHeaders(TENANT_A))
      .set('Authorization', `Bearer ${tokenFor('admin')}`);

    const note = await post('/api/v1/crm/notes', {
      personId,
      body: 'Nota secreta',
    });
    expect(note.status).toBe(201);
    const noteId = bodyOf(note).id as string;

    await request(server())
      .put(`/api/v1/crm/people/${personId}/channel-identities`)
      .set(ingressHeaders(TENANT_A))
      .set('Authorization', `Bearer ${tokenFor('admin')}`)
      .send({
        channel: 'whatsapp',
        externalId: 'wa-secreto-1',
        pushName: 'Push Secreto',
      });

    const getTagB = await get(
      `/api/v1/crm/tags/${tagId}`,
      tokenFor('badmin'),
      TENANT_B,
    );
    expect(getTagB.status).toBe(404);
    expect(bodyOf(getTagB)).toMatchObject({ code: 'tag_not_found' });

    const attachB = await request(server())
      .put(`/api/v1/crm/tags/${tagId}/people/${personId}`)
      .set(ingressHeaders(TENANT_B))
      .set('Authorization', `Bearer ${tokenFor('badmin')}`);
    expect(attachB.status).toBe(404);

    const getNoteB = await get(
      `/api/v1/crm/notes/${noteId}`,
      tokenFor('badmin'),
      TENANT_B,
    );
    expect(getNoteB.status).toBe(404);

    const createNoteB = await post(
      '/api/v1/crm/notes',
      { personId, body: 'Nota vazadora' },
      tokenFor('badmin'),
      TENANT_B,
    );
    expect(createNoteB.status).toBe(404);

    const getIdentityB = await get(
      `/api/v1/crm/people/${personId}/channel-identities`,
      tokenFor('badmin'),
      TENANT_B,
    );
    expect(getIdentityB.status).toBe(404);

    const upsertIdentityB = await request(server())
      .put(`/api/v1/crm/people/${personId}/channel-identities`)
      .set(ingressHeaders(TENANT_B))
      .set('Authorization', `Bearer ${tokenFor('badmin')}`)
      .send({
        channel: 'whatsapp',
        externalId: 'wa-secreto-1',
        pushName: 'Vazador',
      });
    expect(upsertIdentityB.status).toBe(404);

    const getTimelineB = await get(
      `/api/v1/crm/people/${personId}/timeline`,
      tokenFor('badmin'),
      TENANT_B,
    );
    expect(getTimelineB.status).toBe(404);

    const getOrgTimelineB = await get(
      `/api/v1/crm/organizations/${organizationId}/timeline`,
      tokenFor('badmin'),
      TENANT_B,
    );
    expect(getOrgTimelineB.status).toBe(404);

    const stillThere = await get(`/api/v1/crm/people/${personId}`);
    expect(stillThere.status).toBe(200);
    expect(bodyOf(stillThere).fullName).toBe('Pessoa Secreta A');
  });

  it('channel metadata upsert update path never overwrites the confirmed CRM name', async () => {
    const person = await post('/api/v1/crm/people', {
      fullName: 'Nome confirmado no CRM',
    });
    expect(person.status).toBe(201);
    const personId = bodyOf(person).id as string;

    const first = await request(server())
      .put(`/api/v1/crm/people/${personId}/channel-identities`)
      .set(ingressHeaders(TENANT_A))
      .set('Authorization', `Bearer ${tokenFor('admin')}`)
      .send({
        channel: 'whatsapp',
        externalId: 'wa-nome-1',
        pushName: 'Nome do WhatsApp',
      });
    expect(first.status).toBe(200);
    expect(bodyOf(first).pushName).toBe('Nome do WhatsApp');

    const second = await request(server())
      .put(`/api/v1/crm/people/${personId}/channel-identities`)
      .set(ingressHeaders(TENANT_A))
      .set('Authorization', `Bearer ${tokenFor('admin')}`)
      .send({
        channel: 'whatsapp',
        externalId: 'wa-nome-1',
        pushName: 'Outro Nome',
      });
    expect(second.status).toBe(200);
    expect(bodyOf(second).pushName).toBe('Outro Nome');

    const metadata = await tenantAPool.query<{ push_name: string }>(
      `SELECT push_name FROM crm_channel_identities WHERE person_id = $1`,
      [personId],
    );
    expect(metadata.rows[0]?.push_name).toBe('Outro Nome');

    const unchanged = await get(`/api/v1/crm/people/${personId}`);
    expect(bodyOf(unchanged).fullName).toBe('Nome confirmado no CRM');
  });

  it('returns timeline events in chronological ascending order', async () => {
    const organization = await post('/api/v1/crm/organizations', {
      name: 'Org Cronologia',
    });
    expect(organization.status).toBe(201);
    const organizationId = bodyOf(organization).id as string;

    const tag = await post('/api/v1/crm/tags', { name: 'Cronologia' });
    expect(tag.status).toBe(201);
    const tagId = bodyOf(tag).id as string;

    await request(server())
      .put(`/api/v1/crm/tags/${tagId}/organizations/${organizationId}`)
      .set(ingressHeaders(TENANT_A))
      .set('Authorization', `Bearer ${tokenFor('admin')}`);

    await post('/api/v1/crm/notes', { organizationId, body: 'Nota um' });
    await patch(`/api/v1/crm/organizations/${organizationId}`, {
      email: 'cron@org.test',
    });

    const timeline = await get(
      `/api/v1/crm/organizations/${organizationId}/timeline`,
      tokenFor('admin'),
    );
    expect(timeline.status).toBe(200);
    const items = bodyOf(timeline).items as { occurredAt: string }[];
    const occurred = items.map((item) => new Date(item.occurredAt).getTime());
    expect(occurred.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < occurred.length; i++) {
      expect(occurred[i]).toBeGreaterThanOrEqual(occurred[i - 1]);
    }
  });

  /* CRM-07 integration tests */

  it('searches approved fields, normalizes comparisons, and paginates', async () => {
    const organization = await post('/api/v1/crm/organizations', {
      name: 'Pesquisa Teste Ltda',
      cnpj: '12.345.678/0001-90',
      email: 'contato@pesquisa.test',
      phone: '+55 11 4000-0000',
    });
    expect(organization.status).toBe(201);
    const organizationId = bodyOf(organization).id as string;

    const person = await post('/api/v1/crm/people', {
      fullName: 'Maria da Silva',
      cpf: '123.456.789-00',
      email: 'maria@pesquisa.test',
      phone: '+55 11 98765-4321',
      organizationId,
    });
    expect(person.status).toBe(201);
    const personId = bodyOf(person).id as string;

    const byName = await get('/api/v1/crm/search?q=Maria', tokenFor('member'));
    expect(byName.status).toBe(200);
    expect(
      (bodyOf(byName).items as Record<string, unknown>[]).map(
        (item) => item.id,
      ),
    ).toContain(personId);

    const byCompany = await get(
      '/api/v1/crm/search?q=Pesquisa',
      tokenFor('member'),
    );
    expect(byCompany.status).toBe(200);
    const companyResults = bodyOf(byCompany).items as Record<string, unknown>[];
    const companyMatch = companyResults.find((item) => item.id === personId);
    expect(companyMatch).toBeDefined();
    expect(companyMatch?.matchedFields as string[]).toContain('company');

    const byCpf = await get(
      '/api/v1/crm/search?q=12345678900',
      tokenFor('member'),
    );
    expect(byCpf.status).toBe(200);
    expect(
      (bodyOf(byCpf).items as Record<string, unknown>[]).map((item) => item.id),
    ).toContain(personId);

    const byCnpj = await get(
      '/api/v1/crm/search?q=12345678000190',
      tokenFor('member'),
    );
    expect(byCnpj.status).toBe(200);
    expect(
      (bodyOf(byCnpj).items as Record<string, unknown>[]).map(
        (item) => item.id,
      ),
    ).toContain(organizationId);

    const byEmail = await get(
      '/api/v1/crm/search?q=maria@pesquisa.test',
      tokenFor('member'),
    );
    expect(byEmail.status).toBe(200);
    expect(
      (bodyOf(byEmail).items as Record<string, unknown>[]).map(
        (item) => item.id,
      ),
    ).toContain(personId);

    const byPhone = await get(
      '/api/v1/crm/search?q=11987654321',
      tokenFor('member'),
    );
    expect(byPhone.status).toBe(200);
    expect(
      (bodyOf(byPhone).items as Record<string, unknown>[]).map(
        (item) => item.id,
      ),
    ).toContain(personId);

    const tag = await post('/api/v1/crm/tags', {
      name: 'CRM07 Search Tag',
      color: '#ff0000',
    });
    expect(tag.status).toBe(201);
    const tagId = bodyOf(tag).id as string;
    const assignment = await request(server())
      .put('/api/v1/crm/tags/' + tagId + '/people/' + personId)
      .set(ingressHeaders(TENANT_A))
      .set('authorization', 'Bearer ' + tokenFor('member'));
    expect(assignment.status).toBe(200);

    const byTag = await get(
      '/api/v1/crm/search?q=CRM07 Search Tag',
      tokenFor('member'),
    );
    expect(byTag.status).toBe(200);
    expect(
      (bodyOf(byTag).items as Record<string, unknown>[]).map((item) => item.id),
    ).toContain(personId);

    const page1 = await get(
      '/api/v1/crm/search?q=Pesquisa&page=1&pageSize=1',
      tokenFor('member'),
    );
    const page2 = await get(
      '/api/v1/crm/search?q=Pesquisa&page=2&pageSize=1',
      tokenFor('member'),
    );
    expect(page1.status).toBe(200);
    expect(page2.status).toBe(200);
    const firstPage = bodyOf(page1);
    const secondPage = bodyOf(page2);
    expect(firstPage.page).toBe(1);
    expect(firstPage.pageSize).toBe(1);
    expect(firstPage.total).toBe(2);
    expect(secondPage.page).toBe(2);
    expect(secondPage.total).toBe(2);
    expect((firstPage.items as Record<string, unknown>[])[0].id).not.toBe(
      (secondPage.items as Record<string, unknown>[])[0].id,
    );

    const unchanged = await get('/api/v1/crm/people/' + personId);
    expect(unchanged.status).toBe(200);
    expect(bodyOf(unchanged).fullName).toBe('Maria da Silva');
  });

  it('applies CPF/PJ/BOTH scope to search and duplicate warnings', async () => {
    const organization = await post('/api/v1/crm/organizations', {
      name: 'Scope PJ',
    });
    const organizationId = bodyOf(organization).id as string;
    const linked = await post('/api/v1/crm/people', {
      fullName: 'Joao Vinculado',
      phone: '11912345678',
      organizationId,
    });
    const linkedId = bodyOf(linked).id as string;
    const unlinked = await post('/api/v1/crm/people', {
      fullName: 'Maria Sem Vinculo',
      cpf: '987.654.321-00',
    });
    const unlinkedId = bodyOf(unlinked).id as string;

    const cpfLinkedSearch = await get(
      '/api/v1/crm/search?q=Vinculado',
      tokenFor('cpf'),
    );
    const pjLinkedSearch = await get(
      '/api/v1/crm/search?q=Vinculado',
      tokenFor('pj'),
    );
    const bothLinkedSearch = await get(
      '/api/v1/crm/search?q=Vinculado',
      tokenFor('member'),
    );
    expect(cpfLinkedSearch.status).toBe(200);
    expect(pjLinkedSearch.status).toBe(200);
    expect(bothLinkedSearch.status).toBe(200);
    expect(
      (bodyOf(cpfLinkedSearch).items as Record<string, unknown>[]).map(
        (item) => item.id,
      ),
    ).not.toContain(linkedId);
    expect(
      (bodyOf(pjLinkedSearch).items as Record<string, unknown>[]).map(
        (item) => item.id,
      ),
    ).toContain(linkedId);
    expect(
      (bodyOf(bothLinkedSearch).items as Record<string, unknown>[]).map(
        (item) => item.id,
      ),
    ).toContain(linkedId);

    const cpfUnlinkedSearch = await get(
      '/api/v1/crm/search?q=Maria',
      tokenFor('cpf'),
    );
    const pjUnlinkedSearch = await get(
      '/api/v1/crm/search?q=Maria',
      tokenFor('pj'),
    );
    const bothUnlinkedSearch = await get(
      '/api/v1/crm/search?q=Maria',
      tokenFor('member'),
    );
    expect(
      (bodyOf(cpfUnlinkedSearch).items as Record<string, unknown>[]).map(
        (item) => item.id,
      ),
    ).toContain(unlinkedId);
    expect(
      (bodyOf(pjUnlinkedSearch).items as Record<string, unknown>[]).map(
        (item) => item.id,
      ),
    ).not.toContain(unlinkedId);
    expect(
      (bodyOf(bothUnlinkedSearch).items as Record<string, unknown>[]).map(
        (item) => item.id,
      ),
    ).toContain(unlinkedId);

    const cpfDuplicates = await get(
      '/api/v1/crm/duplicates/possible?entityType=person&phone=11912345678',
      tokenFor('cpf'),
    );
    const pjDuplicates = await get(
      '/api/v1/crm/duplicates/possible?entityType=person&phone=11912345678',
      tokenFor('pj'),
    );
    expect(cpfDuplicates.status).toBe(200);
    expect(pjDuplicates.status).toBe(200);
    expect(bodyOf(cpfDuplicates).possibleDuplicates).toEqual([]);
    expect(bodyOf(pjDuplicates).possibleDuplicates).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: linkedId })]),
    );
  });

  it('isolates search results between tenant databases', async () => {
    const tenantAPerson = await post('/api/v1/crm/people', {
      fullName: 'Segredo Exclusivo A',
      phone: '11955550000',
    });
    expect(tenantAPerson.status).toBe(201);
    const tenantAPersonId = bodyOf(tenantAPerson).id as string;

    const tenantBOrganization = await post(
      '/api/v1/crm/organizations',
      { name: 'Publica Exclusiva B' },
      tokenFor('badmin'),
      TENANT_B,
    );
    expect(tenantBOrganization.status).toBe(201);
    const tenantBOrganizationId = bodyOf(tenantBOrganization).id as string;

    const tenantBSecretSearch = await get(
      '/api/v1/crm/search?q=Segredo',
      tokenFor('badmin'),
      TENANT_B,
    );
    const tenantBOwnSearch = await get(
      '/api/v1/crm/search?q=Publica',
      tokenFor('badmin'),
      TENANT_B,
    );
    const tenantASearch = await get('/api/v1/crm/search?q=Segredo');
    expect(tenantBSecretSearch.status).toBe(200);
    expect(tenantBOwnSearch.status).toBe(200);
    expect(tenantASearch.status).toBe(200);
    expect(bodyOf(tenantBSecretSearch).items).toEqual([]);
    expect(
      (bodyOf(tenantBOwnSearch).items as Record<string, unknown>[]).map(
        (item) => item.id,
      ),
    ).toContain(tenantBOrganizationId);
    expect(
      (bodyOf(tenantASearch).items as Record<string, unknown>[]).map(
        (item) => item.id,
      ),
    ).toContain(tenantAPersonId);

    const tenantBDuplicateCheck = await get(
      '/api/v1/crm/duplicates/possible?entityType=person&phone=11955550000',
      tokenFor('badmin'),
      TENANT_B,
    );
    expect(tenantBDuplicateCheck.status).toBe(200);
    expect(bodyOf(tenantBDuplicateCheck).possibleDuplicates).toEqual([]);
  });

  it('returns explainable duplicate candidates without mutation and bounds results', async () => {
    const firstPerson = await post('/api/v1/crm/people', {
      fullName: 'Duplicada Formatada',
      cpf: '123.456.789-00',
    });
    const secondPerson = await post('/api/v1/crm/people', {
      fullName: 'Duplicada Sem Formato',
      cpf: '12345678900',
    });
    expect(firstPerson.status).toBe(201);
    expect(secondPerson.status).toBe(201);
    const firstPersonId = bodyOf(firstPerson).id as string;
    const secondPersonId = bodyOf(secondPerson).id as string;

    const personDuplicates = await get(
      '/api/v1/crm/duplicates/possible?entityType=person&cpf=123.456.789-00',
      tokenFor('member'),
    );
    expect(personDuplicates.status).toBe(200);
    const personCandidates = bodyOf(personDuplicates)
      .possibleDuplicates as Record<string, unknown>[];
    for (const id of [firstPersonId, secondPersonId]) {
      const candidate = personCandidates.find((item) => item.id === id);
      expect(candidate).toBeDefined();
      expect(candidate?.matchedOn as string[]).toContain('cpf');
    }

    const firstOrganization = await post('/api/v1/crm/organizations', {
      name: 'Organizacao Formatada',
      cnpj: '12.345.678/0001-90',
    });
    const secondOrganization = await post('/api/v1/crm/organizations', {
      name: 'Organizacao Sem Formato',
      cnpj: '12345678000190',
    });
    expect(firstOrganization.status).toBe(201);
    expect(secondOrganization.status).toBe(201);
    const firstOrganizationId = bodyOf(firstOrganization).id as string;
    const secondOrganizationId = bodyOf(secondOrganization).id as string;

    const organizationDuplicates = await get(
      '/api/v1/crm/duplicates/possible?entityType=organization&cnpj=12.345.678/0001-90',
      tokenFor('member'),
    );
    expect(organizationDuplicates.status).toBe(200);
    const organizationCandidates = bodyOf(organizationDuplicates)
      .possibleDuplicates as Record<string, unknown>[];
    for (const id of [firstOrganizationId, secondOrganizationId]) {
      const candidate = organizationCandidates.find((item) => item.id === id);
      expect(candidate).toBeDefined();
      expect(candidate?.matchedOn as string[]).toContain('cnpj');
    }

    const phoneCandidates: string[] = [];
    for (let index = 0; index < 6; index += 1) {
      const person = await post('/api/v1/crm/people', {
        fullName: 'Phone Duplicate ' + String(index),
        phone: '11999990000',
      });
      expect(person.status).toBe(201);
      phoneCandidates.push(bodyOf(person).id as string);
    }
    const phoneDuplicates = await get(
      '/api/v1/crm/duplicates/possible?entityType=person&phone=11999990000',
      tokenFor('member'),
    );
    expect(phoneDuplicates.status).toBe(200);
    const phoneResult = bodyOf(phoneDuplicates);
    expect(phoneResult.possibleDuplicates).toHaveLength(5);
    expect(phoneResult.truncated).toBe(true);
    expect(
      (phoneResult.possibleDuplicates as Record<string, unknown>[]).every(
        (candidate) =>
          (candidate.matchedOn as string[]).includes('phone') &&
          phoneCandidates.includes(candidate.id as string),
      ),
    ).toBe(true);

    const invalid = await get(
      '/api/v1/crm/duplicates/possible?entityType=person',
      tokenFor('member'),
    );
    expect(invalid.status).toBe(400);

    const unchangedPerson = await get('/api/v1/crm/people/' + firstPersonId);
    const unchangedOrganization = await get(
      '/api/v1/crm/organizations/' + firstOrganizationId,
    );
    expect(bodyOf(unchangedPerson).fullName).toBe('Duplicada Formatada');
    expect(bodyOf(unchangedOrganization).name).toBe('Organizacao Formatada');
    expect(
      (bodyOf(phoneDuplicates).possibleDuplicates as unknown[]).length,
    ).toBe(5);
  });

  it('imports CSV atomically and exposes row-level validation errors without PII', async () => {
    const invalidImport = await request(server())
      .post('/api/v1/crm/csv/import?entityType=person')
      .set('content-type', 'text/csv')
      .set('authorization', `Bearer ${tokenFor('member')}`)
      .set(ingressHeaders(TENANT_A))
      .send('fullName,email\nMaria,maria@example.com\nJose,invalido');
    expect(invalidImport.status).toBe(200);
    expect(invalidImport.body).toMatchObject({
      imported: 0,
      invalid: 1,
      errors: [{ row: 3, code: 'invalid_email' }],
    });
    expect(JSON.stringify(invalidImport.body)).not.toContain('Maria');
    const people = await get('/api/v1/crm/people', tokenFor('member'));
    expect(bodyOf(people).total).toBe(0);

    const imported = await request(server())
      .post('/api/v1/crm/csv/import?entityType=person')
      .set('content-type', 'text/csv')
      .set('authorization', `Bearer ${tokenFor('member')}`)
      .set(ingressHeaders(TENANT_A))
      .send(
        '\uFEFFfullName,cpf,email,phone\r\n"Maria, Silva",123.456.789-00,maria@example.com,11912345678',
      );
    expect(imported.status).toBe(200);
    expect(imported.body).toMatchObject({
      imported: 1,
      invalid: 0,
      errors: [],
    });
    const exportedByMember = await get(
      '/api/v1/crm/csv/export?entityType=person',
      tokenFor('member'),
    );
    expect(exportedByMember.status).toBe(403);
    const exportedByAdmin = await get(
      '/api/v1/crm/csv/export?entityType=person',
    );
    expect(exportedByAdmin.status).toBe(200);
    expect(exportedByAdmin.text).toContain('Maria, Silva');
    const auditRows = await adminPool.query<{
      action: string;
      resource_id: string | null;
    }>(
      `SELECT action, resource_id FROM audit_events
       WHERE tenant_id = $1 AND action IN ('crm.person.csv_imported', 'crm.person.csv_exported')`,
      [tenantAId],
    );
    const auditActions = auditRows.rows.map((row) => row.action);
    expect(auditActions).toContain('crm.person.csv_imported');
    expect(auditActions).toContain('crm.person.csv_exported');
    expect(auditRows.rows.every((row) => row.resource_id === null)).toBe(true);
  });

  it('enforces CSV customer scope and tenant isolation on import and export', async () => {
    const organization = await post('/api/v1/crm/organizations', {
      name: '=Tenant A Formula',
      cnpj: '12345678000190',
    });
    expect(organization.status).toBe(201);
    const orgId = bodyOf(organization).id as string;

    const deniedCpfImport = await request(server())
      .post('/api/v1/crm/csv/import?entityType=person')
      .set('content-type', 'text/csv')
      .set('authorization', `Bearer ${tokenFor('cpf')}`)
      .set(ingressHeaders(TENANT_A))
      .send(`fullName,organizationId\nContact,${orgId}`);
    expect(deniedCpfImport.status).toBe(200);
    expect(deniedCpfImport.body).toMatchObject({ imported: 0, invalid: 1 });

    const bOrganization = await post(
      '/api/v1/crm/organizations',
      { name: 'Tenant B Only', cnpj: '98765432000190' },
      tokenFor('badmin'),
      TENANT_B,
    );
    expect(bOrganization.status).toBe(201);
    const exportB = await get(
      '/api/v1/crm/csv/export?entityType=organization',
      tokenFor('badmin'),
      TENANT_B,
    );
    expect(exportB.status).toBe(200);
    expect(exportB.text).toContain('Tenant B Only');
    expect(exportB.text).not.toContain('Tenant A Formula');

    const exportA = await get('/api/v1/crm/csv/export?entityType=organization');
    expect(exportA.status).toBe(200);
    expect(exportA.text).toContain("'=Tenant A Formula");
    expect(exportA.text).not.toContain('Tenant B Only');
  });

  it('lists and updates tenant member scope only for the same tenant admin', async () => {
    const list = await get('/api/v1/crm/memberships', tokenFor('admin'));
    expect(list.status).toBe(200);
    expect(list.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: actorIds.get('member'),
          role: 'tenant_member',
          customerScope: 'both',
          status: 'active',
        }),
      ]),
    );

    const deniedList = await get('/api/v1/crm/memberships', tokenFor('member'));
    expect(deniedList.status).toBe(403);

    const actorId = actorIds.get('member')!;
    const update = await request(server())
      .put(`/api/v1/crm/memberships/${actorId}/scope`)
      .set('content-type', 'application/json')
      .set('authorization', `Bearer ${tokenFor('admin')}`)
      .set(ingressHeaders(TENANT_A))
      .send({ customerScope: 'pj' });
    expect(update.status).toBe(200);
    expect((update.body as Record<string, unknown>).customerScope).toBe('pj');

    const crossTenant = await request(server())
      .put(`/api/v1/crm/memberships/${actorId}/scope`)
      .set('content-type', 'application/json')
      .set('authorization', `Bearer ${tokenFor('badmin')}`)
      .set(ingressHeaders(TENANT_B))
      .send({ customerScope: 'cpf' });
    expect(crossTenant.status).toBe(404);
    const afterDeniedUpdate = await get(
      '/api/v1/crm/memberships',
      tokenFor('admin'),
    );
    expect(
      (afterDeniedUpdate.body as Record<string, unknown>[]).find(
        (member) => member.actorId === actorId,
      )?.customerScope,
    ).toBe('pj');
  });

  it('exposes the authenticated tenant role and a scope-checked relationship list', async () => {
    const actorContext = await get('/api/v1/crm/context', tokenFor('pj'));
    expect(actorContext.status).toBe(200);
    expect(actorContext.body).toEqual({
      role: 'tenant_member',
      customerScope: 'pj',
    });

    const organization = await post(
      '/api/v1/crm/organizations',
      { name: 'Relationship List Org' },
      tokenFor('pj'),
    );
    const organizationId = bodyOf(organization).id as string;
    const person = await post(
      '/api/v1/crm/people',
      {
        fullName: 'Relationship List Person',
        organizationId,
      },
      tokenFor('pj'),
    );
    expect(person.status).toBe(201);
    const personId = bodyOf(person).id as string;
    const list = await get(
      `/api/v1/crm/people/${personId}/relationships`,
      tokenFor('pj'),
    );
    expect(list.status).toBe(200);
    expect((list.body as { items: unknown[] }).items).toEqual([
      expect.objectContaining({
        personId,
        organizationId,
        organizationName: 'Relationship List Org',
      }),
    ]);
    const denied = await get(
      `/api/v1/crm/people/${personId}/relationships`,
      tokenFor('cpf'),
    );
    expect(denied.status).toBe(403);
  });
});
