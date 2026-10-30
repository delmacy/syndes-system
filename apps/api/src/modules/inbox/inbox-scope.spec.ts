import { and, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import type { TenantContext } from '../platform-core/identity/identity.contracts';
import { inboxConversations } from './inbox.schema';
import {
  conversationScopeCondition,
  membershipScopeCondition,
  resolveMemberAssignment,
} from './inbox-scope';

/** Offline query renderer: never opens a connection. */
const db = drizzle({ client: {} as Pool });

function render(condition: ReturnType<typeof conversationScopeCondition>): {
  sql: string;
  params: unknown[];
} {
  const query = db
    .select({ id: inboxConversations.id })
    .from(inboxConversations)
    .where(condition);
  return query.toSQL();
}

const baseContext: TenantContext = {
  actorId: 'a1',
  tenantId: 't1',
  databaseName: 'sdb_t1',
  role: 'tenant_member',
  customerScope: 'both',
};

describe('INBOX-02 customer scope predicate (G6 correction)', () => {
  it('does not filter a tenant_admin at all', () => {
    expect(
      conversationScopeCondition({ ...baseContext, role: 'tenant_admin' }),
    ).toBeUndefined();
  });

  it('cpf sees only Persons without a PJ link and without an Organization', () => {
    const condition = conversationScopeCondition({
      ...baseContext,
      customerScope: 'cpf',
    });
    expect(condition).toBeDefined();
    const { sql: rendered, params } = render(condition);
    expect(rendered).toContain('"inbox_conversations"."person_id" IS NOT NULL');
    expect(rendered).toContain(
      '"inbox_conversations"."organization_id" IS NULL',
    );
    expect(rendered).toContain('NOT EXISTS');
    expect(rendered).toContain('"crm_relationships"');
    expect(rendered).toContain('rel."person_id"');
    expect(params).toEqual([]);
  });

  it('pj sees Organizations and Persons linked to an Organization', () => {
    const condition = conversationScopeCondition({
      ...baseContext,
      customerScope: 'pj',
    });
    expect(condition).toBeDefined();
    const { sql: rendered } = render(condition);
    expect(rendered).toContain(
      '"inbox_conversations"."organization_id" IS NOT NULL',
    );
    expect(rendered).toContain('EXISTS');
    expect(rendered).toContain('"crm_relationships"');
    expect(rendered).not.toContain('NOT EXISTS');
    expect(rendered).not.toContain(
      '"inbox_conversations"."person_id" IS NOT NULL AND',
    );
  });

  it('both sees only conversations linked to a Person or an Organization', () => {
    const condition = conversationScopeCondition({
      ...baseContext,
      customerScope: 'both',
    });
    expect(condition).toBeDefined();
    const { sql: rendered } = render(condition);
    expect(rendered).toContain('"inbox_conversations"."person_id" IS NOT NULL');
    expect(rendered).toContain(
      '"inbox_conversations"."organization_id" IS NOT NULL',
    );
    expect(rendered).toContain('OR');
  });

  it('produces distinct predicates for cpf and pj (regression: G6)', () => {
    const cpf = render(
      conversationScopeCondition({ ...baseContext, customerScope: 'cpf' }),
    ).sql;
    const pj = render(
      conversationScopeCondition({ ...baseContext, customerScope: 'pj' }),
    ).sql;
    expect(cpf).not.toBe(pj);
    expect(cpf).toContain('NOT EXISTS');
    expect(pj).toContain('OR');
  });

  it('keeps an unlinked conversation invisible to every member scope', () => {
    for (const customerScope of ['cpf', 'pj', 'both'] as const) {
      const condition = conversationScopeCondition({
        ...baseContext,
        customerScope,
      });
      const { sql: rendered } = render(condition);
      // Every member predicate requires a CRM link; a row with both columns
      // NULL cannot satisfy any of them.
      expect(rendered).toMatch(/person_id|organization_id/);
    }
  });

  it('fails closed for an unexpected scope value', () => {
    const condition = conversationScopeCondition({
      ...baseContext,
      customerScope: 'unexpected' as TenantContext['customerScope'],
    });
    expect(render(condition).sql).toContain('1 = 0');
  });

  it('still composes with an explicit record id', () => {
    const condition = and(
      sql`${inboxConversations.id} = ${'11111111-1111-4111-8111-111111111111'}`,
      conversationScopeCondition({ ...baseContext, customerScope: 'cpf' }),
    );
    const { sql: rendered, params } = render(condition);
    expect(rendered).toContain('"inbox_conversations"."id" = $1');
    expect(params).toEqual(['11111111-1111-4111-8111-111111111111']);
  });
});

describe('INBOX-02 assignment authorization helpers', () => {
  it('does not restrict membership listing for admins or resolved scopes', () => {
    expect(membershipScopeCondition('tenant_admin', 'both')).toBeUndefined();
    expect(membershipScopeCondition('tenant_member', 'both')).toBeUndefined();
    expect(membershipScopeCondition('tenant_member', 'cpf')).toBeDefined();
    expect(membershipScopeCondition('tenant_member', 'pj')).toBeDefined();
  });

  it('lets an admin assign any target, including another member', () => {
    expect(
      resolveMemberAssignment(
        { ...baseContext, role: 'tenant_admin' },
        'someone-else',
      ),
    ).toEqual({ allowed: true });
  });

  it('lets a member release and assume their own conversation only', () => {
    expect(resolveMemberAssignment(baseContext, null)).toEqual({
      allowed: true,
    });
    expect(resolveMemberAssignment(baseContext, baseContext.actorId)).toEqual({
      allowed: true,
    });
    expect(resolveMemberAssignment(baseContext, 'peer')).toEqual({
      allowed: false,
      reason: 'forbidden',
    });
  });
});
