import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import type {
  TenantCrmDatabase,
  TenantCrmDb,
} from '../../core-crm/tenant-crm.database';
import { CrmProblemException } from '../../core-crm/crm-problem-details';
import type { InboxAuditWriter } from '../inbox-audit';
import type {
  InboxMembershipPort,
  TenantMembership,
} from '../inbox-membership.port';
import type { InboxRealtimeHub } from '../realtime/inbox-realtime.hub';
import { AssignmentService } from './assignment.service';

const CONVERSATION_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MEMBER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PEER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function conversationRow(overrides: Record<string, unknown> = {}) {
  return {
    conversation: {
      id: CONVERSATION_ID,
      personId: '55555555-5555-4555-8555-555555555555',
      organizationId: null,
      status: 'open',
      assigneeActorId: null,
      channel: 'whatsapp',
      createdAt: new Date('2026-10-28T09:00:00.000Z'),
      updatedAt: new Date('2026-10-28T09:00:00.000Z'),
      ...overrides,
    },
    personName: 'Ana Souza',
    organizationName: null,
    preview: null,
  };
}

const adminContext: TenantContext = {
  actorId: ADMIN_ID,
  tenantId: '44444444-4444-4444-8444-444444444444',
  databaseName: 'sdb_tenant',
  role: 'tenant_admin',
  customerScope: 'both',
};

const memberContext: TenantContext = {
  ...adminContext,
  actorId: MEMBER_ID,
  role: 'tenant_member',
  customerScope: 'cpf',
};

function buildService(options: {
  conversations?: unknown[][];
  member?: TenantMembership | null;
  updateRows?: (target: string | null) => unknown[];
}) {
  const updateTargets: (string | null)[] = [];
  const conversations = options.conversations ?? [[conversationRow()]];
  const db = {
    select: () => {
      const chain = {
        from: () => chain,
        leftJoin: () => chain,
        where: () => chain,
        limit: () => Promise.resolve(conversations.shift() ?? []),
      };
      return chain;
    },
    update: () => ({
      set: (values: { assigneeActorId: string | null }) => ({
        where: () => ({
          returning: () => {
            updateTargets.push(values.assigneeActorId);
            const buildRows =
              options.updateRows ??
              ((target: string | null) => [
                { ...conversationRow().conversation, assigneeActorId: target },
              ]);
            return Promise.resolve(buildRows(values.assigneeActorId));
          },
        }),
      }),
    }),
  } as unknown as TenantCrmDb;

  let dbCalls = 0;
  const tenantDb = {
    withTenant: (
      _context: TenantContext,
      run: (database: TenantCrmDb) => unknown,
    ) => {
      dbCalls += 1;
      return run(db);
    },
  } as unknown as TenantCrmDatabase;
  const findActiveMember = jest.fn().mockResolvedValue(options.member ?? null);
  const audit = {
    success: jest.fn().mockResolvedValue(undefined),
    denied: jest.fn().mockResolvedValue(undefined),
  };
  const publish = jest.fn().mockResolvedValue(undefined);
  const service = new AssignmentService(
    tenantDb,
    { findActiveMember } as unknown as InboxMembershipPort,
    audit as unknown as InboxAuditWriter,
    { publish } as unknown as InboxRealtimeHub,
  );
  return {
    service,
    findActiveMember,
    audit,
    publish,
    updateTargets,
    dbCalls: () => dbCalls,
  };
}

const activeMember: TenantMembership = {
  actorId: PEER_ID,
  role: 'tenant_member',
  customerScope: 'both',
};

describe('INBOX-02 conversation assignment', () => {
  it('lets a tenant_admin assign any active member of the tenant', async () => {
    const { service, findActiveMember, audit, publish } = buildService({
      member: activeMember,
      updateRows: (target) => [
        { ...conversationRow().conversation, assigneeActorId: target },
      ],
    });

    const result = await service.update(adminContext, CONVERSATION_ID, {
      assigneeActorId: PEER_ID,
    });

    expect(findActiveMember).toHaveBeenCalledWith(adminContext, PEER_ID);
    expect(audit.success).toHaveBeenCalledWith(
      adminContext,
      'inbox.conversation.assigned',
      'conversation',
      CONVERSATION_ID,
    );
    expect(publish).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      success: true,
      conversationId: CONVERSATION_ID,
      assigneeActorId: PEER_ID,
    });
  });

  it('refuses a foreign/inactive/unknown target with a non-leaking validation problem', async () => {
    const { service, audit, publish } = buildService({ member: null });

    const error = await service
      .update(adminContext, CONVERSATION_ID, { assigneeActorId: PEER_ID })
      .then(
        () => {
          throw new Error('expected assignment to fail');
        },
        (raised: unknown) => raised,
      );

    expect(error).toBeInstanceOf(CrmProblemException);
    const problem = error as CrmProblemException;
    expect(problem.getStatus()).toBe(400);
    expect(problem.getResponse()).toMatchObject({
      code: 'validation_failed',
      errors: [{ field: 'assigneeActorId', rule: 'not_active_member' }],
    });
    expect(audit.denied).toHaveBeenCalledWith(
      adminContext,
      'inbox.conversation.assigned',
      'conversation',
      CONVERSATION_ID,
    );
    expect(publish).not.toHaveBeenCalled();
  });

  it('lets a member assume the conversation itself', async () => {
    const { service, findActiveMember, audit } = buildService({
      conversations: [[conversationRow()], [conversationRow()]],
      member: { ...activeMember, actorId: MEMBER_ID, customerScope: 'cpf' },
      updateRows: (target) => [
        { ...conversationRow().conversation, assigneeActorId: target },
      ],
    });

    const result = await service.update(memberContext, CONVERSATION_ID, {
      assigneeActorId: MEMBER_ID,
    });

    expect(findActiveMember).toHaveBeenCalledWith(memberContext, MEMBER_ID);
    expect(result.assigneeActorId).toBe(MEMBER_ID);
    expect(audit.success).toHaveBeenCalled();
  });

  it('lets a member release the conversation to the shared queue', async () => {
    const { service, findActiveMember, audit } = buildService({
      updateRows: () => [
        { ...conversationRow().conversation, assigneeActorId: null },
      ],
    });

    const result = await service.update(memberContext, CONVERSATION_ID, {
      assigneeActorId: null,
    });

    expect(findActiveMember).not.toHaveBeenCalled();
    expect(result.assigneeActorId).toBeNull();
    expect(audit.success).toHaveBeenCalled();
  });

  it('forbids a member from assigning a peer and audits the denial', async () => {
    const { service, findActiveMember, audit, publish } = buildService({});

    await expect(
      service.update(memberContext, CONVERSATION_ID, {
        assigneeActorId: PEER_ID,
      }),
    ).rejects.toMatchObject({ response: { code: 'forbidden' } });

    expect(findActiveMember).not.toHaveBeenCalled();
    expect(audit.denied).toHaveBeenCalledWith(
      memberContext,
      'inbox.conversation.assigned',
      'conversation',
      CONVERSATION_ID,
    );
    expect(publish).not.toHaveBeenCalled();
  });

  it('maps an invisible/foreign conversation to not found before authorization', async () => {
    const { service, findActiveMember, audit } = buildService({
      conversations: [[]],
    });

    await expect(
      service.update(adminContext, CONVERSATION_ID, {
        assigneeActorId: PEER_ID,
      }),
    ).rejects.toMatchObject({
      response: { code: 'inbox_conversation_not_found' },
    });
    expect(findActiveMember).not.toHaveBeenCalled();
    expect(audit.success).not.toHaveBeenCalled();
  });
});
