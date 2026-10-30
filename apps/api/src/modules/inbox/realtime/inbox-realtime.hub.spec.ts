import type { TenantContext } from '../../../platform-core/identity/identity.contracts';
import { InboxRealtimeHub } from './inbox-realtime.hub';
import type { InboxRealtimeAuthorizer } from './inbox-realtime.authorizer';
import { tenantMembershipInactiveProblem } from './inbox-realtime.authorizer';
import { createInboxRealtimeEvent } from './inbox-realtime.contracts';

const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CONV_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CONV_B = 'dddddddd-dddd-4ddd-8bbb-bbbbbbbbbbbb';

const baseContext: TenantContext = {
  actorId: ACTOR_ID,
  tenantId: TENANT_ID,
  databaseName: 'sdb_tenant',
  role: 'tenant_member',
  customerScope: 'cpf',
};

function sink() {
  return { event: jest.fn(), heartbeat: jest.fn(), closed: jest.fn() };
}

function authorizerWith(
  resolveMembershipResult: {
    actorId: string;
    tenantId: string;
    databaseName: string;
    role: 'tenant_member';
    customerScope: 'cpf';
  } | null,
  visible = true,
) {
  const resolveMembership = jest
    .fn()
    .mockResolvedValue(resolveMembershipResult);
  const isConversationVisible = jest.fn().mockResolvedValue(visible);
  const assertSubscriptionsVisible = jest.fn().mockImplementation(() => {
    if (!resolveMembershipResult) throw tenantMembershipInactiveProblem();
    return Promise.resolve(resolveMembershipResult ?? baseContext);
  });
  const authorizer = {
    resolveMembership,
    isConversationVisible,
    assertSubscriptionsVisible,
  } as unknown as InboxRealtimeAuthorizer;
  return {
    authorizer,
    resolveMembership,
    isConversationVisible,
    assertSubscriptionsVisible,
  };
}

function hubWith(authorizer: InboxRealtimeAuthorizer) {
  return new InboxRealtimeHub(authorizer);
}

describe('INBOX-04 realtime hub', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens a subscription for explicit conversations after authorization', async () => {
    const { authorizer, assertSubscriptionsVisible } =
      authorizerWith(baseContext);
    const hub = hubWith(authorizer);
    const s = sink();

    const sub = await hub.open(baseContext, [CONV_A], s);

    expect(assertSubscriptionsVisible).toHaveBeenCalledWith(baseContext, [
      CONV_A,
    ]);
    expect(typeof sub.close).toBe('function');
    sub.close();
  });

  it('opens an implicit subscription when no conversation ids are given', async () => {
    const { authorizer, resolveMembership } = authorizerWith(baseContext);
    const hub = hubWith(authorizer);
    const s = sink();

    const sub = await hub.open(baseContext, null, s);

    expect(resolveMembership).toHaveBeenCalledWith(baseContext);
    expect(typeof sub.close).toBe('function');
    sub.close();
  });

  it('refuses to open when membership is inactive', async () => {
    const { authorizer } = authorizerWith(null);
    const hub = hubWith(authorizer);
    await expect(hub.open(baseContext, [CONV_A], sink())).rejects.toMatchObject(
      {
        response: { code: 'tenant_membership_inactive' },
      },
    );
  });

  it('delivers an event only to subscribers whose scope and explicit list allow it', async () => {
    const { authorizer } = authorizerWith(baseContext, true);
    const hub = hubWith(authorizer);
    const sA = sink();
    const sB = sink();

    await hub.open(baseContext, [CONV_A], sA);
    await hub.open(baseContext, [CONV_B], sB);

    const event = createInboxRealtimeEvent('inbox.message.created', CONV_A, {
      messageId: 'm-1',
    });

    await hub.publish(event);

    expect(sA.event).toHaveBeenCalledWith(event);
    expect(sB.event).not.toHaveBeenCalled();
  });

  it('skips delivery when the conversation is not visible to the subscriber', async () => {
    const { authorizer } = authorizerWith(baseContext, false);
    const hub = hubWith(authorizer);
    const s = sink();
    await hub.open(baseContext, null, s);

    const event = createInboxRealtimeEvent('inbox.message.created', CONV_A, {
      messageId: 'm-1',
    });

    await hub.publish(event);

    expect(s.event).not.toHaveBeenCalled();
  });

  it('skips delivery and closes a subscription whose membership is revoked', async () => {
    const { authorizer, resolveMembership } = authorizerWith(null, true);
    resolveMembership
      .mockResolvedValueOnce(baseContext)
      .mockResolvedValue(null);
    const hub = hubWith(authorizer);
    const s = sink();
    await hub.open(baseContext, null, s);

    const event = createInboxRealtimeEvent('inbox.message.created', CONV_A, {
      messageId: 'm-1',
    });

    await hub.publish(event);

    expect(s.event).not.toHaveBeenCalled();
    expect(s.closed).toHaveBeenCalledWith('revoked');
  });

  it('revalidateAll closes revoked sessions and heartbeats active ones', async () => {
    const { authorizer } = authorizerWith(baseContext, true);
    const hub = hubWith(authorizer);
    const s = sink();
    await hub.open(baseContext, null, s);

    await hub.revalidateAll();

    expect(s.heartbeat).toHaveBeenCalled();
    expect(s.closed).not.toHaveBeenCalled();
  });

  it('revalidateAll closes a session whose membership became inactive', async () => {
    const { authorizer, resolveMembership } = authorizerWith(null, true);
    resolveMembership
      .mockResolvedValueOnce(baseContext)
      .mockResolvedValue(null);
    const hub = hubWith(authorizer);
    const s = sink();
    await hub.open(baseContext, null, s);

    await hub.revalidateAll();

    expect(s.closed).toHaveBeenCalledWith('revoked');
    expect(s.heartbeat).not.toHaveBeenCalled();
  });
});
