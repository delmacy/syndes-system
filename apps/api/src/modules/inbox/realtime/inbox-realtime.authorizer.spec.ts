import type { TenantContext } from '../../../platform-core/identity/identity.contracts';
import type { TenantCrmDatabase } from '../../../core-crm/tenant-crm.database';
import type { InboxMembershipPort } from '../inbox-membership.port';
import { InboxRealtimeAuthorizer } from './inbox-realtime.authorizer';
import { tenantMembershipInactiveProblem } from './inbox-realtime.authorizer';

const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CONVERSATION_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const baseContext: TenantContext = {
  actorId: ACTOR_ID,
  tenantId: TENANT_ID,
  databaseName: 'sdb_tenant',
  role: 'tenant_member',
  customerScope: 'cpf',
};

function membership(
  role: 'tenant_admin' | 'tenant_member',
  scope: 'cpf' | 'pj' | 'both',
) {
  return { actorId: ACTOR_ID, role, customerScope: scope };
}

function authorizerWith(
  membershipResult: { role: string; customerScope: string } | null,
  visibleRows: unknown[] = [],
) {
  const findActiveMember = jest.fn().mockResolvedValue(membershipResult);
  const membershipPort = { findActiveMember } as unknown as InboxMembershipPort;
  const queryDb = {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve(visibleRows) }),
      }),
    }),
  };
  const db = {
    withTenant: (_ctx: TenantContext, work: (q: typeof queryDb) => unknown) =>
      work(queryDb),
  };
  return {
    authorizer: new InboxRealtimeAuthorizer(
      db as unknown as TenantCrmDatabase,
      membershipPort,
    ),
    membershipPort,
    findActiveMember,
  };
}

describe('INBOX-04 realtime authorizer', () => {
  beforeEach(() => jest.clearAllMocks());

  it('refreshes role and customer scope from an active membership', async () => {
    const { authorizer, findActiveMember } = authorizerWith({
      role: 'tenant_admin',
      customerScope: 'both',
    });
    const refreshed = await authorizer.resolveMembership(baseContext);
    expect(refreshed).toMatchObject({
      actorId: ACTOR_ID,
      tenantId: TENANT_ID,
      role: 'tenant_admin',
      customerScope: 'both',
    });
    expect(findActiveMember).toHaveBeenCalledWith(baseContext, ACTOR_ID);
  });

  it('returns null when membership is no longer active', async () => {
    const { authorizer } = authorizerWith(null);
    await expect(authorizer.resolveMembership(baseContext)).resolves.toBeNull();
  });

  it('reports a conversation as visible when a row matches scope + id', async () => {
    const { authorizer } = authorizerWith(membership('tenant_member', 'cpf'), [
      { id: CONVERSATION_ID },
    ]);
    const refreshed = await authorizer.resolveMembership(baseContext);
    await expect(
      authorizer.isConversationVisible(refreshed!, CONVERSATION_ID),
    ).resolves.toBe(true);
  });

  it('reports a foreign/invisible conversation as not visible', async () => {
    const { authorizer } = authorizerWith(
      membership('tenant_member', 'cpf'),
      [],
    );
    const refreshed = await authorizer.resolveMembership(baseContext);
    await expect(
      authorizer.isConversationVisible(refreshed!, 'foreign-id'),
    ).resolves.toBe(false);
  });

  it('asserts subscriptions visible: inactive membership is forbidden', async () => {
    const { authorizer } = authorizerWith(null);
    await expect(
      authorizer.assertSubscriptionsVisible(baseContext, [CONVERSATION_ID]),
    ).rejects.toMatchObject({
      response: { code: 'tenant_membership_inactive' },
    });
  });

  it('asserts subscriptions visible: an invisible conversation is not found', async () => {
    const { authorizer } = authorizerWith(
      membership('tenant_member', 'cpf'),
      [],
    );
    const refreshed = await authorizer.resolveMembership(baseContext);
    await expect(
      authorizer.assertSubscriptionsVisible(refreshed!, [CONVERSATION_ID]),
    ).rejects.toMatchObject({
      response: { code: 'inbox_conversation_not_found' },
    });
  });

  it('asserts subscriptions visible and returns the refreshed context', async () => {
    const { authorizer } = authorizerWith(membership('tenant_member', 'cpf'), [
      { id: CONVERSATION_ID },
    ]);
    const refreshed = await authorizer.resolveMembership(baseContext);
    const result = await authorizer.assertSubscriptionsVisible(refreshed!, [
      CONVERSATION_ID,
    ]);
    expect(result.role).toBe('tenant_member');
    expect(result.customerScope).toBe('cpf');
  });
});

describe('tenantMembershipInactiveProblem', () => {
  it('is a forbidden problem with a stable code', () => {
    const problem = tenantMembershipInactiveProblem();
    expect(problem.getStatus()).toBe(403);
    expect((problem as { response: { code: string } }).response.code).toBe(
      'tenant_membership_inactive',
    );
  });
});
