import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
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
import { CoreCrmModule } from '../core-crm/core-crm.module';
import { registerCsvBodyParser } from '../core-crm/csv/csv-body-parser';
import { InboxModule } from './inbox.module';

const TENANT_INTEGRATION_TIMEOUT_MS = 180000;
const TENANT_DATABASE_DISCONNECT_TIMEOUT_MS = 5000;
const TENANT_DATABASE_DISCONNECT_POLL_MS = 25;
const CONFIGURED_ISSUER = 'https://id.test/realms/syndes';
const PLATFORM_ADMIN_TOKEN = 'platform-token';
const TENANT_A = 'tenant-a.inbox.test';
const TENANT_B = 'tenant-b.inbox.test';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function waitForTenantDatabaseConnectionsToClose(
  adminPool: Pool,
  databaseName: string,
): Promise<void> {
  const deadline = Date.now() + TENANT_DATABASE_DISCONNECT_TIMEOUT_MS;

  while (true) {
    const result = await adminPool.query<{ pid: number }>(
      `SELECT pid
         FROM pg_stat_activity
        WHERE datname = $1
          AND pid <> pg_backend_pid()
          AND backend_type = 'client backend'`,
      [databaseName],
    );
    if (result.rowCount === 0) return;
    if (Date.now() >= deadline) {
      throw new Error(
        `Timed out waiting for ${result.rowCount} client connection(s) to close for tenant database ${databaseName}.`,
      );
    }

    await new Promise<void>((resolve) =>
      setTimeout(resolve, TENANT_DATABASE_DISCONNECT_POLL_MS),
    );
  }
}

const describeIntegration =
  process.env.CONTROL_PLANE_DATABASE_URL &&
  process.env.TENANT_ADMIN_DATABASE_URL
    ? describe
    : describe.skip;

/**
 * INBOX-02 integration + contract proof over disposable PostgreSQL: the real
 * Inbox HTTP surface (guards, DTOs, services), the real Core CRM tenant
 * database routing/provisioning and the real Control Plane membership/audit,
 * driven over HTTP against two disposable per-tenant databases.
 *
 * Covers the INBOX-02 acceptance surface: tenant migration baseline,
 * cross-tenant isolation, `tenant_admin` vs fixed `customer_scope`
 * (`cpf`/`pj`/`both`) visibility, unlinked conversations admin-only,
 * assignment with live membership validation, status transitions, the merged
 * public/private timeline with a stable `(created_at, id)` cursor,
 * Idempotency-Key replay/retry honesty and content-free audit records.
 *
 * Skipped when no disposable database URLs are bound locally; runs inside the
 * API CI job.
 */
describeIntegration('INBOX-02 Inbox API (disposable PostgreSQL)', () => {
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
    aAdmin: { subject: 'inbox-a-admin-subject' },
    aBoth: { subject: 'inbox-a-both-subject' },
    aCpf: { subject: 'inbox-a-cpf-subject' },
    aPj: { subject: 'inbox-a-pj-subject' },
    aInactive: { subject: 'inbox-a-inactive-subject' },
    bAdmin: { subject: 'inbox-b-admin-subject' },
    bBoth: { subject: 'inbox-b-both-subject' },
    platform: { subject: 'inbox-platform-subject', platformAdmin: true },
  };

  function tokenFor(name: string): string {
    return `${name}-token`;
  }

  beforeAll(async () => {
    process.env.INGRESS_SIGNING_SECRET ||=
      'inbox-integration-test-ingress-signing-secret';
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
      imports: [PlatformCoreModule, ManagerModule, CoreCrmModule, InboxModule],
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
    registerCsvBodyParser(app);
    await app.init();

    tenantAId = await createAndProvisionTenant('Inbox Tenant A');
    tenantBId = await createAndProvisionTenant('Inbox Tenant B');
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
    tenantAdminPools = [...secretStore.records.values()].map(
      (credential) =>
        new Pool({
          host: controlPlaneUrl.hostname,
          port: Number(controlPlaneUrl.port || '5432'),
          user: controlPlaneUrl.username,
          password: controlPlaneUrl.password || undefined,
          database: credential.databaseName,
          max: 1,
        }),
    );

    await adminPool.query(
      `INSERT INTO tenant_domains (hostname, tenant_id) VALUES ($1, $2), ($3, $4)`,
      [TENANT_A, tenantAId, TENANT_B, tenantBId],
    );

    await insertMembership(tenantAId, 'aAdmin', 'tenant_admin', 'both');
    await insertMembership(tenantAId, 'aBoth', 'tenant_member', 'both');
    await insertMembership(tenantAId, 'aCpf', 'tenant_member', 'cpf');
    await insertMembership(tenantAId, 'aPj', 'tenant_member', 'pj');
    await insertMembership(
      tenantAId,
      'aInactive',
      'tenant_member',
      'both',
      'revoked',
    );
    await insertMembership(tenantBId, 'bAdmin', 'tenant_admin', 'both');
    await insertMembership(tenantBId, 'bBoth', 'tenant_member', 'both');
  }, TENANT_INTEGRATION_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
    if (tenantPools) {
      await Promise.all([...tenantPools.values()].map((pool) => pool.end()));
    }
    await Promise.all(tenantAdminPools.map((pool) => pool.end()));
    for (const databaseName of disposableNames[0]?.databases ?? []) {
      await waitForTenantDatabaseConnectionsToClose(adminPool, databaseName);
      await adminPool.query(
        `DROP DATABASE IF EXISTS ${quotePgIdentifier(databaseName)}`,
      );
    }
    for (const roleName of disposableNames[0]?.roles ?? []) {
      await adminPool.query(
        `DROP ROLE IF EXISTS ${quotePgIdentifier(roleName)}`,
      );
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

  function adminPost(urlPath: string, body?: unknown) {
    const agent = request(server())
      .post(urlPath)
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
    status: 'active' | 'revoked' = 'active',
  ): Promise<void> {
    await adminPool.query(
      `INSERT INTO tenant_memberships (tenant_id, actor_id, role, customer_scope, status)
       SELECT $1, a.id, $3, $4, $5
         FROM identity_actors a
         WHERE a.subject = $2`,
      [tenantId, actorDefinitions[actorName].subject, role, scope, status],
    );
  }

  beforeEach(async () => {
    await adminPool.query(`TRUNCATE TABLE audit_events RESTART IDENTITY`);
    for (const pool of tenantAdminPools) {
      // These dedicated integration databases are reset between scenarios.
      // TRUNCATE bypasses append-only triggers on the CRM timeline.
      await pool.query(`TRUNCATE TABLE
        inbox_attachments,
        inbox_private_notes,
        inbox_messages,
        inbox_conversations,
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

  function get(
    urlPath: string,
    token = 'aAdmin-token',
    host: string = TENANT_A,
  ) {
    return request(server())
      .get(urlPath)
      .set('authorization', `Bearer ${token}`)
      .set(ingressHeaders(host));
  }

  function post(
    urlPath: string,
    body: unknown,
    token = 'aAdmin-token',
    host: string = TENANT_A,
    extraHeaders: Record<string, string> = {},
  ) {
    return request(server())
      .post(urlPath)
      .set('content-type', 'application/json')
      .set('authorization', `Bearer ${token}`)
      .set(ingressHeaders(host))
      .set(extraHeaders)
      .send(body);
  }

  function patch(
    urlPath: string,
    body: unknown,
    token = 'aAdmin-token',
    host: string = TENANT_A,
  ) {
    return request(server())
      .patch(urlPath)
      .set('content-type', 'application/json')
      .set('authorization', `Bearer ${token}`)
      .set(ingressHeaders(host))
      .send(body);
  }

  function bodyOf(response: { text: string }): Record<string, unknown> {
    return JSON.parse(response.text) as Record<string, unknown>;
  }

  function actorIdOf(name: string): string {
    const id = actorIds.get(name);
    if (!id) throw new Error(`Unknown test actor ${name}`);
    return id;
  }

  function assertSecretFree(value: string): void {
    for (const forbidden of [
      'sdb_',
      'tapp_',
      'postgres://',
      'postgresql://',
      'password',
    ]) {
      expect(value).not.toContain(forbidden);
    }
  }

  async function createOrganization(
    name: string,
    token = 'aAdmin-token',
  ): Promise<string> {
    const created = await post('/api/v1/crm/organizations', { name }, token);
    expect(created.status).toBe(201);
    return bodyOf(created).id as string;
  }

  async function createPerson(
    fullName: string,
    organizationId?: string,
    token = 'aAdmin-token',
  ): Promise<string> {
    const created = await post(
      '/api/v1/crm/people',
      { fullName, ...(organizationId ? { organizationId } : {}) },
      token,
    );
    expect(created.status).toBe(201);
    return bodyOf(created).id as string;
  }

  interface ConversationSeed {
    personId?: string | null;
    organizationId?: string | null;
    channel?: 'whatsapp' | 'email' | 'unknown';
    status?: 'open' | 'pending' | 'resolved';
    pool?: Pool;
  }

  async function seedConversation(seed: ConversationSeed): Promise<string> {
    const pool = seed.pool ?? tenantAPool;
    const result = await pool.query<{ id: string }>(
      `INSERT INTO inbox_conversations (person_id, organization_id, channel, status)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        seed.personId ?? null,
        seed.organizationId ?? null,
        seed.channel ?? 'whatsapp',
        seed.status ?? 'open',
      ],
    );
    return result.rows[0].id;
  }

  interface MessageSeed {
    conversationId: string;
    direction: 'inbound' | 'outbound';
    body: string;
    authorActorId?: string;
    authorExternalId?: string;
    externalId?: string;
    idempotencyKey?: string;
    deliveryStatus?: 'pending' | 'dispatched' | 'failed';
    createdAt?: string;
    pool?: Pool;
  }

  async function seedMessage(seed: MessageSeed): Promise<string> {
    const pool = seed.pool ?? tenantAPool;
    const result = await pool.query<{ id: string }>(
      `INSERT INTO inbox_messages (
         conversation_id, direction, body, author_actor_id, author_external_id,
         external_id, idempotency_key, delivery_status, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        seed.conversationId,
        seed.direction,
        seed.body,
        seed.direction === 'outbound' ? (seed.authorActorId ?? null) : null,
        seed.direction === 'inbound'
          ? (seed.authorExternalId ?? 'external-author')
          : null,
        seed.externalId ?? null,
        seed.idempotencyKey ?? null,
        seed.deliveryStatus ??
          (seed.direction === 'inbound' ? 'dispatched' : 'pending'),
        seed.createdAt ?? new Date(),
      ],
    );
    return result.rows[0].id;
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
    return result.rows.filter((row) => row.action.startsWith('inbox.'));
  }

  async function conversationCount(pool: Pool): Promise<number> {
    const result = await pool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM inbox_conversations`,
    );
    return result.rows[0].count;
  }

  it('provisions both tenant databases with the full Inbox baseline', async () => {
    for (const pool of [tenantAPool, tenantBPool]) {
      const tables = await pool.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
          ORDER BY table_name`,
      );
      const names = tables.rows.map((row) => row.table_name);
      expect(names).toEqual(
        expect.arrayContaining([
          'crm_people',
          'crm_organizations',
          'inbox_conversations',
          'inbox_messages',
          'inbox_private_notes',
          'inbox_attachments',
        ]),
      );
      const columns = await pool.query<{ column_name: string }>(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'inbox_messages'
          ORDER BY column_name`,
      );
      expect(columns.rows.map((row) => row.column_name)).toEqual(
        expect.arrayContaining([
          'author_actor_id',
          'author_external_id',
          'delivery_status',
          'external_id',
          'idempotency_key',
          'source_channel',
        ]),
      );
    }
  });

  it('requires identity, trusted routing and a tenant membership on every route', async () => {
    const conversationId = await seedConversation({});

    const unauthenticated = await request(server())
      .get('/api/v1/inbox/conversations')
      .set(ingressHeaders(TENANT_A));
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.type).toBe('application/problem+json');
    expect(bodyOf(unauthenticated)).toMatchObject({
      status: 401,
      code: 'unauthorized',
    });
    assertSecretFree(unauthenticated.text);

    const unrouted = await request(server())
      .get('/api/v1/inbox/conversations')
      .set('authorization', `Bearer ${tokenFor('aAdmin')}`);
    expect(unrouted.status).toBe(404);

    const unknownHost = await get(
      '/api/v1/inbox/conversations',
      tokenFor('aAdmin'),
      'tenant-unknown.inbox.test',
    );
    expect(unknownHost.status).toBe(404);

    const platformAdmin = await request(server())
      .get('/api/v1/inbox/conversations')
      .set('authorization', `Bearer ${PLATFORM_ADMIN_TOKEN}`);
    expect(platformAdmin.status).toBe(404);

    const selector = await post(
      `/api/v1/inbox/conversations/${conversationId}/messages`,
      { body: 'Olá', tenantId: 'attacker', databaseName: 'sdb_x' },
      tokenFor('aAdmin'),
      TENANT_A,
      { 'Idempotency-Key': 'selector-key' },
    );
    expect(selector.status).toBe(400);
    // Rejected by the trusted TenantContext guard before any Inbox code runs:
    // a client can never provide a tenant/database selector.
    expect(bodyOf(selector)).toMatchObject({ code: 'bad_request' });
    assertSecretFree(selector.text);

    const selectorsInQuery = await get(
      '/api/v1/inbox/conversations?tenantId=attacker',
      tokenFor('aAdmin'),
    );
    expect(selectorsInQuery.status).toBe(400);
    expect(bodyOf(selectorsInQuery)).toMatchObject({ code: 'bad_request' });
  });

  it('scopes the queue by customer_scope and keeps unlinked conversations admin-only', async () => {
    const organizationId = await createOrganization('Alfa Ltda');
    const personCpf = await createPerson('Ana CPF');
    const personPj = await createPerson('Bruno PJ', organizationId);

    const cpfConversation = await seedConversation({
      personId: personCpf,
      status: 'open',
    });
    const pjOrgConversation = await seedConversation({
      organizationId,
      channel: 'email',
      status: 'pending',
    });
    const pjPersonConversation = await seedConversation({
      personId: personPj,
      status: 'resolved',
    });
    const unlinkedConversation = await seedConversation({});

    const adminQueue = await get(
      '/api/v1/inbox/conversations?page=1&pageSize=50',
      tokenFor('aAdmin'),
    );
    expect(adminQueue.status).toBe(200);
    const adminIds = (bodyOf(adminQueue).items as { id: string }[]).map(
      (item) => item.id,
    );
    expect(adminIds).toEqual(
      expect.arrayContaining([
        cpfConversation,
        pjOrgConversation,
        pjPersonConversation,
        unlinkedConversation,
      ]),
    );
    expect(bodyOf(adminQueue)).toMatchObject({
      page: 1,
      pageSize: 50,
      total: 4,
    });

    const cpfQueue = await get(
      '/api/v1/inbox/conversations?pageSize=50',
      tokenFor('aCpf'),
    );
    expect(cpfQueue.status).toBe(200);
    expect(
      (bodyOf(cpfQueue).items as { id: string }[]).map((item) => item.id),
    ).toEqual([cpfConversation]);
    expect(bodyOf(cpfQueue).total).toBe(1);

    const pjQueue = await get(
      '/api/v1/inbox/conversations?pageSize=50',
      tokenFor('aPj'),
    );
    expect(
      (bodyOf(pjQueue).items as { id: string }[]).map((item) => item.id).sort(),
    ).toEqual([pjOrgConversation, pjPersonConversation].sort());

    const bothQueue = await get(
      '/api/v1/inbox/conversations?pageSize=50',
      tokenFor('aBoth'),
    );
    const bothIds = (bodyOf(bothQueue).items as { id: string }[]).map(
      (item) => item.id,
    );
    expect(bothIds).not.toContain(unlinkedConversation);
    expect(bothIds).toHaveLength(3);

    const unlinkedAdmin = await get(
      `/api/v1/inbox/conversations/${unlinkedConversation}`,
      tokenFor('aAdmin'),
    );
    expect(unlinkedAdmin.status).toBe(200);
    expect(bodyOf(unlinkedAdmin)).toMatchObject({
      id: unlinkedConversation,
      subject: null,
      customerId: null,
      person: null,
      organization: null,
      unreadCount: 0,
      preview: '',
    });

    for (const token of ['aBoth-token', 'aCpf-token', 'aPj-token']) {
      const hidden = await get(
        `/api/v1/inbox/conversations/${unlinkedConversation}`,
        token,
      );
      expect(hidden.status).toBe(404);
      expect(bodyOf(hidden)).toMatchObject({
        code: 'inbox_conversation_not_found',
      });
    }

    const resolvedFilter = await get(
      '/api/v1/inbox/conversations?status=resolved&pageSize=50',
      tokenFor('aBoth'),
    );
    expect(
      (bodyOf(resolvedFilter).items as { id: string }[]).map((item) => item.id),
    ).toEqual([pjPersonConversation]);

    const emailFilter = await get(
      '/api/v1/inbox/conversations?channel=email&pageSize=50',
      tokenFor('aPj'),
    );
    expect(
      (bodyOf(emailFilter).items as { id: string }[]).map((item) => item.id),
    ).toEqual([pjOrgConversation]);

    const foreignDetail = await get(
      `/api/v1/inbox/conversations/${cpfConversation}`,
      tokenFor('aPj'),
    );
    expect(foreignDetail.status).toBe(404);
    expect(bodyOf(foreignDetail).code).toBe('inbox_conversation_not_found');
  });

  it('never exposes one tenant Inbox to another tenant', async () => {
    const personId = await createPerson('Ana Isolada');
    const conversationId = await seedConversation({ personId });
    await seedMessage({
      conversationId,
      direction: 'inbound',
      body: 'Mensagem privada',
      externalId: 'ext-isolation',
    });

    const list = await get(
      '/api/v1/inbox/conversations?pageSize=50',
      tokenFor('bAdmin'),
      TENANT_B,
    );
    expect(list.status).toBe(200);
    expect(bodyOf(list)).toMatchObject({ total: 0, items: [] });

    const attempts: Array<() => ReturnType<typeof get>> = [
      () =>
        get(
          `/api/v1/inbox/conversations/${conversationId}`,
          tokenFor('bAdmin'),
          TENANT_B,
        ),
      () =>
        get(
          `/api/v1/inbox/conversations/${conversationId}/messages`,
          tokenFor('bAdmin'),
          TENANT_B,
        ),
      () =>
        post(
          `/api/v1/inbox/conversations/${conversationId}/messages`,
          { body: 'invadindo' },
          tokenFor('bAdmin'),
          TENANT_B,
          { 'Idempotency-Key': 'tenant-b-key' },
        ),
      () =>
        post(
          `/api/v1/inbox/conversations/${conversationId}/notes`,
          { body: 'nota do outro tenant' },
          tokenFor('bAdmin'),
          TENANT_B,
        ),
      () =>
        patch(
          `/api/v1/inbox/conversations/${conversationId}/assignment`,
          { assigneeActorId: actorIdOf('bBoth') },
          tokenFor('bAdmin'),
          TENANT_B,
        ),
      () =>
        patch(
          `/api/v1/inbox/conversations/${conversationId}/status`,
          { status: 'resolved' },
          tokenFor('bAdmin'),
          TENANT_B,
        ),
    ];
    for (const attempt of attempts) {
      const response = await attempt();
      expect(response.status).toBe(404);
      expect(bodyOf(response).code).toBe('inbox_conversation_not_found');
    }

    const rows = await tenantAPool.query<{ messages: number; notes: number }>(
      `SELECT
         (SELECT count(*)::int FROM inbox_messages WHERE conversation_id = $1) AS messages,
         (SELECT count(*)::int FROM inbox_private_notes WHERE conversation_id = $1) AS notes`,
      [conversationId],
    );
    expect(rows.rows[0]).toEqual({ messages: 1, notes: 0 });
    expect(await conversationCount(tenantBPool)).toBe(0);
    const status = await tenantAPool.query<{ status: string }>(
      `SELECT status FROM inbox_conversations WHERE id = $1`,
      [conversationId],
    );
    expect(status.rows[0].status).toBe('open');
  });

  it('merges public messages and private notes and keeps notes out of channels', async () => {
    const personId = await createPerson('Ana Timeline');
    const conversationId = await seedConversation({ personId });
    const inboundId = await seedMessage({
      conversationId,
      direction: 'inbound',
      body: 'mensagem pública recebida',
      externalId: 'ext-timeline',
      createdAt: '2026-10-28T10:00:00.123456Z',
    });

    const note = await post(
      `/api/v1/inbox/conversations/${conversationId}/notes`,
      { body: 'nota interna sigilosa' },
      tokenFor('aBoth'),
    );
    expect(note.status).toBe(201);
    expect(bodyOf(note)).toMatchObject({
      success: true,
      conversationId,
    });
    const noteId = bodyOf(note).noteId as string;
    expect(noteId).toMatch(UUID_PATTERN);

    const reply = await post(
      `/api/v1/inbox/conversations/${conversationId}/messages`,
      { body: 'resposta pública' },
      tokenFor('aBoth'),
      TENANT_A,
      { 'Idempotency-Key': 'timeline-reply' },
    );
    expect(reply.status).toBe(201);
    expect(bodyOf(reply)).toMatchObject({
      success: true,
      deliveryStatus: 'pending',
    });
    const replyId = bodyOf(reply).messageId as string;
    expect(replyId).toMatch(UUID_PATTERN);

    const history = await get(
      `/api/v1/inbox/conversations/${conversationId}/messages?limit=50`,
      tokenFor('aCpf'),
    );
    expect(history.status).toBe(200);
    const entries = bodyOf(history) as unknown as {
      id: string;
      kind: string;
      content: string;
      deliveryStatus?: string;
      author: { role: string };
    }[];
    const ids = entries.map((entry) => entry.id);
    expect(ids.indexOf(inboundId)).toBeLessThan(ids.indexOf(noteId));
    expect(ids.indexOf(noteId)).toBeLessThan(ids.indexOf(replyId));

    const noteEntry = entries.find((entry) => entry.id === noteId)!;
    expect(noteEntry).toMatchObject({
      kind: 'note',
      content: 'nota interna sigilosa',
      author: { role: 'agent' },
    });
    expect(noteEntry.deliveryStatus).toBeUndefined();

    const replyEntry = entries.find((entry) => entry.id === replyId)!;
    expect(replyEntry).toMatchObject({
      kind: 'outgoing',
      content: 'resposta pública',
      deliveryStatus: 'pending',
    });

    // A private note is never persisted or dispatched as a channel message.
    const leaked = await tenantAPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM inbox_messages
        WHERE conversation_id = $1 AND body = 'nota interna sigilosa'`,
      [conversationId],
    );
    expect(leaked.rows[0].count).toBe(0);

    const persisted = await tenantAPool.query<{
      delivery_status: string;
      direction: string;
      author_actor_id: string | null;
      idempotency_key: string | null;
    }>(
      `SELECT delivery_status, direction, author_actor_id, idempotency_key
         FROM inbox_messages WHERE id = $1`,
      [replyId],
    );
    expect(persisted.rows[0]).toEqual({
      delivery_status: 'pending',
      direction: 'outbound',
      author_actor_id: actorIdOf('aBoth'),
      idempotency_key: 'timeline-reply',
    });

    // Content never appears in the audit trail.
    const audit = await adminPool.query<{ payload: string }>(
      `SELECT row_to_json(audit_events)::text AS payload FROM audit_events
        WHERE tenant_id = $1`,
      [tenantAId],
    );
    for (const row of audit.rows) {
      expect(row.payload).not.toContain('nota interna sigilosa');
      expect(row.payload).not.toContain('resposta pública');
      expect(row.payload).not.toContain('mensagem pública recebida');
    }
  });

  it('pages the merged timeline by id cursor, including microsecond timestamps', async () => {
    const personId = await createPerson('Ana Cursor');
    const conversationId = await seedConversation({ personId });
    const first = await seedMessage({
      conversationId,
      direction: 'inbound',
      body: 'primeira com microssegundos',
      externalId: 'ext-cursor-1',
      createdAt: '2026-10-28T11:00:00.123456Z',
    });
    const second = await seedMessage({
      conversationId,
      direction: 'outbound',
      body: 'segunda com microssegundos',
      authorActorId: actorIdOf('aBoth'),
      deliveryStatus: 'dispatched',
      createdAt: '2026-10-28T11:00:00.123457Z',
    });

    const page1 = await get(
      `/api/v1/inbox/conversations/${conversationId}/messages?limit=1`,
      tokenFor('aBoth'),
    );
    expect(page1.status).toBe(200);
    const page1Ids = (bodyOf(page1) as unknown as { id: string }[]).map(
      (entry) => entry.id,
    );
    expect(page1Ids).toEqual([first]);

    const page2 = await get(
      `/api/v1/inbox/conversations/${conversationId}/messages?limit=1&after=${first}`,
      tokenFor('aBoth'),
    );
    expect(page2.status).toBe(200);
    expect(
      (bodyOf(page2) as unknown as { id: string }[]).map((entry) => entry.id),
    ).toEqual([second]);

    const unknownCursor = await get(
      `/api/v1/inbox/conversations/${conversationId}/messages?after=${randomUUID()}`,
      tokenFor('aBoth'),
    );
    expect(unknownCursor.status).toBe(404);
    expect(bodyOf(unknownCursor)).toMatchObject({
      code: 'inbox_message_cursor_not_found',
    });
  });

  it('deduplicates public replies by Idempotency-Key and never claims delivery', async () => {
    const personId = await createPerson('Ana Idempotente');
    const conversationId = await seedConversation({ personId });

    const first = await post(
      `/api/v1/inbox/conversations/${conversationId}/messages`,
      { body: 'olá uma vez' },
      tokenFor('aBoth'),
      TENANT_A,
      { 'Idempotency-Key': 'reply-key-1' },
    );
    expect(first.status).toBe(201);
    const firstBody = bodyOf(first);
    expect(firstBody).toMatchObject({
      success: true,
      deliveryStatus: 'pending',
      externalId: null,
    });
    expect(firstBody.messageId).toMatch(UUID_PATTERN);

    const replay = await post(
      `/api/v1/inbox/conversations/${conversationId}/messages`,
      { body: 'olá uma vez' },
      tokenFor('aBoth'),
      TENANT_A,
      { 'Idempotency-Key': 'reply-key-1' },
    );
    expect(replay.status).toBe(201);
    expect(bodyOf(replay).messageId).toBe(firstBody.messageId);

    const other = await post(
      `/api/v1/inbox/conversations/${conversationId}/messages`,
      { body: 'outra mensagem' },
      tokenFor('aBoth'),
      TENANT_A,
      { 'Idempotency-Key': 'reply-key-2' },
    );
    expect(other.status).toBe(201);
    expect(bodyOf(other).messageId).not.toBe(firstBody.messageId);

    const rows = await tenantAPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM inbox_messages
        WHERE conversation_id = $1 AND direction = 'outbound'`,
      [conversationId],
    );
    expect(rows.rows[0].count).toBe(2);
    const keyed = await tenantAPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM inbox_messages
        WHERE conversation_id = $1 AND idempotency_key = 'reply-key-1'`,
      [conversationId],
    );
    expect(keyed.rows[0].count).toBe(1);

    const missingKey = await post(
      `/api/v1/inbox/conversations/${conversationId}/messages`,
      { body: 'sem chave' },
      tokenFor('aBoth'),
    );
    expect(missingKey.status).toBe(400);
    expect(bodyOf(missingKey)).toMatchObject({
      code: 'validation_failed',
      errors: [{ field: 'Idempotency-Key', rule: 'required' }],
    });

    const emptyBody = await post(
      `/api/v1/inbox/conversations/${conversationId}/messages`,
      { body: '' },
      tokenFor('aBoth'),
      TENANT_A,
      { 'Idempotency-Key': 'reply-key-3' },
    );
    expect(emptyBody.status).toBe(400);
    expect(bodyOf(emptyBody)).toMatchObject({ code: 'validation_failed' });

    const actions = await auditActions(tenantAId);
    const created = actions.filter(
      (row) => row.action === 'inbox.message.created',
    );
    // One creation audit per distinct Idempotency-Key; the replay is not a
    // second creation.
    expect(created).toHaveLength(2);
    expect(created.every((row) => row.result === 'success')).toBe(true);
  });

  it('applies assignment rules with live same-tenant membership validation', async () => {
    const personId = await createPerson('Ana Atribuída');
    const conversationId = await seedConversation({ personId });

    const assigned = await patch(
      `/api/v1/inbox/conversations/${conversationId}/assignment`,
      { assigneeActorId: actorIdOf('aBoth') },
      tokenFor('aAdmin'),
    );
    expect(assigned.status).toBe(200);
    expect(bodyOf(assigned)).toMatchObject({
      success: true,
      conversationId,
      assigneeActorId: actorIdOf('aBoth'),
    });

    const persisted = await tenantAPool.query<{
      assignee_actor_id: string | null;
    }>(`SELECT assignee_actor_id FROM inbox_conversations WHERE id = $1`, [
      conversationId,
    ]);
    expect(persisted.rows[0].assignee_actor_id).toBe(actorIdOf('aBoth'));

    const filtered = await get(
      `/api/v1/inbox/conversations?assignee=${actorIdOf('aBoth')}&pageSize=50`,
      tokenFor('aAdmin'),
    );
    expect(
      (bodyOf(filtered).items as { id: string }[]).map((item) => item.id),
    ).toEqual([conversationId]);

    const selfAssigned = await patch(
      `/api/v1/inbox/conversations/${conversationId}/assignment`,
      { assigneeActorId: actorIdOf('aBoth') },
      tokenFor('aBoth'),
    );
    expect(selfAssigned.status).toBe(200);

    const peer = await patch(
      `/api/v1/inbox/conversations/${conversationId}/assignment`,
      { assigneeActorId: actorIdOf('aPj') },
      tokenFor('aBoth'),
    );
    expect(peer.status).toBe(403);
    expect(bodyOf(peer)).toMatchObject({ code: 'forbidden' });

    const released = await patch(
      `/api/v1/inbox/conversations/${conversationId}/assignment`,
      { assigneeActorId: null },
      tokenFor('aBoth'),
    );
    expect(released.status).toBe(200);
    expect(bodyOf(released).assigneeActorId).toBeNull();

    const foreign = await patch(
      `/api/v1/inbox/conversations/${conversationId}/assignment`,
      { assigneeActorId: actorIdOf('bBoth') },
      tokenFor('aAdmin'),
    );
    expect(foreign.status).toBe(400);
    expect(bodyOf(foreign)).toMatchObject({
      code: 'validation_failed',
      errors: [{ field: 'assigneeActorId', rule: 'not_active_member' }],
    });

    const revoked = await patch(
      `/api/v1/inbox/conversations/${conversationId}/assignment`,
      { assigneeActorId: actorIdOf('aInactive') },
      tokenFor('aAdmin'),
    );
    expect(revoked.status).toBe(400);
    expect(bodyOf(revoked)).toMatchObject({
      code: 'validation_failed',
      errors: [{ field: 'assigneeActorId', rule: 'not_active_member' }],
    });

    const actions = await auditActions(tenantAId);
    const assignmentResults = actions
      .filter((row) => row.action === 'inbox.conversation.assigned')
      .map((row) => row.result);
    expect(assignmentResults).toEqual(
      expect.arrayContaining(['success', 'denied']),
    );
  });

  it('changes status with the frozen vocabulary and audits each transition', async () => {
    const personId = await createPerson('Ana Status');
    const conversationId = await seedConversation({ personId });

    for (const status of ['pending', 'resolved', 'open'] as const) {
      const response = await patch(
        `/api/v1/inbox/conversations/${conversationId}/status`,
        { status },
        tokenFor('aBoth'),
      );
      expect(response.status).toBe(200);
      expect(bodyOf(response)).toMatchObject({
        success: true,
        conversationId,
        status,
      });
    }

    const detail = await get(
      `/api/v1/inbox/conversations/${conversationId}`,
      tokenFor('aBoth'),
    );
    expect(bodyOf(detail).status).toBe('open');

    const invalid = await patch(
      `/api/v1/inbox/conversations/${conversationId}/status`,
      { status: 'closed' },
      tokenFor('aBoth'),
    );
    expect(invalid.status).toBe(400);
    expect(bodyOf(invalid)).toMatchObject({ code: 'validation_failed' });

    const actions = await auditActions(tenantAId);
    expect(
      actions.filter(
        (row) => row.action === 'inbox.conversation.status.changed',
      ),
    ).toHaveLength(3);
  });
});
