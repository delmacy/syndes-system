import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import type {
  TenantCrmDatabase,
  TenantCrmDb,
} from '../../core-crm/tenant-crm.database';
import type { InboxAuditWriter } from '../inbox-audit';
import type { InboxRealtimeHub } from '../realtime/inbox-realtime.hub';
import { StatusService } from './status.service';

const CONVERSATION_ID = '11111111-1111-4111-8111-111111111111';

const memberContext: TenantContext = {
  actorId: '33333333-3333-4333-8333-333333333333',
  tenantId: '44444444-4444-4444-8444-444444444444',
  databaseName: 'sdb_tenant',
  role: 'tenant_member',
  customerScope: 'pj',
};

function conversationRow(overrides: Record<string, unknown> = {}) {
  return {
    conversation: {
      id: CONVERSATION_ID,
      personId: null,
      organizationId: '55555555-5555-4555-8555-555555555555',
      status: 'open',
      assigneeActorId: null,
      channel: 'email',
      createdAt: new Date('2026-10-28T09:00:00.000Z'),
      updatedAt: new Date('2026-10-28T09:00:00.000Z'),
      ...overrides,
    },
    personName: null,
    organizationName: 'Alfa Ltda',
    preview: null,
  };
}

function buildService(options: {
  conversations?: unknown[][];
  updatedStatus?: string;
}) {
  const conversations = options.conversations ?? [[conversationRow()]];
  const written: { status: string | undefined }[] = [];
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
      set: (values: { status?: string; updatedAt?: Date }) => ({
        where: () => ({
          returning: () => {
            written.push({ status: values.status });
            return Promise.resolve([
              {
                ...conversationRow().conversation,
                status: options.updatedStatus ?? values.status,
                updatedAt: values.updatedAt,
              },
            ]);
          },
        }),
      }),
    }),
  } as unknown as TenantCrmDb;

  const tenantDb = {
    withTenant: (
      _context: TenantContext,
      run: (database: TenantCrmDb) => unknown,
    ) => run(db),
  } as unknown as TenantCrmDatabase;
  const audit = { success: jest.fn().mockResolvedValue(undefined) };
  const publish = jest.fn().mockResolvedValue(undefined);
  const service = new StatusService(
    tenantDb,
    audit as unknown as InboxAuditWriter,
    { publish } as unknown as InboxRealtimeHub,
  );
  return { service, written, audit, publish };
}

describe('INBOX-02 conversation status', () => {
  it.each(['open', 'pending', 'resolved'] as const)(
    'persists the %s status and audits the change',
    async (status) => {
      const { service, written, audit, publish } = buildService({});

      const result = await service.update(memberContext, CONVERSATION_ID, {
        status,
      });

      expect(written).toEqual([{ status }]);
      expect(result).toMatchObject({
        success: true,
        conversationId: CONVERSATION_ID,
        status,
      });
      expect(audit.success).toHaveBeenCalledWith(
        memberContext,
        'inbox.conversation.status.changed',
        'conversation',
        CONVERSATION_ID,
      );
      expect(publish).toHaveBeenCalledTimes(1);
    },
  );

  it('bumps updated_at so the queue reflects the change', async () => {
    const { service } = buildService({});
    const before = Date.now();

    const result = await service.update(memberContext, CONVERSATION_ID, {
      status: 'pending',
    });

    expect(new Date(result.updatedAt).getTime()).toBeGreaterThanOrEqual(before);
  });

  it('never allows a status change on a conversation outside customer_scope', async () => {
    const { service, written, audit } = buildService({ conversations: [[]] });

    await expect(
      service.update(memberContext, CONVERSATION_ID, { status: 'resolved' }),
    ).rejects.toMatchObject({
      response: { code: 'inbox_conversation_not_found' },
    });
    expect(written).toEqual([]);
    expect(audit.success).not.toHaveBeenCalled();
  });
});
