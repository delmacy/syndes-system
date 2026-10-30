import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import type {
  TenantCrmDatabase,
  TenantCrmDb,
} from '../../core-crm/tenant-crm.database';
import type { InboxAuditWriter } from '../inbox-audit';
import type { InboxRealtimeHub } from '../realtime/inbox-realtime.hub';
import { NotesService } from './notes.service';

const CONVERSATION_ID = '11111111-1111-4111-8111-111111111111';
const NOTE_ID = '66666666-6666-4666-8666-666666666666';
const ACTOR_ID = '33333333-3333-4333-8333-333333333333';

const memberContext: TenantContext = {
  actorId: ACTOR_ID,
  tenantId: '44444444-4444-4444-8444-444444444444',
  databaseName: 'sdb_tenant',
  role: 'tenant_member',
  customerScope: 'both',
};

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

function noteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTE_ID,
    conversationId: CONVERSATION_ID,
    authorActorId: ACTOR_ID,
    body: 'nota interna',
    createdAt: new Date('2026-10-28T10:00:00.000Z'),
    ...overrides,
  };
}

interface InsertedValues {
  conversationId: string;
  authorActorId: string;
  body: string;
}

function buildService(options: {
  conversations: unknown[][];
  note?: Record<string, unknown>;
  failInsert?: Error;
}) {
  const inserted: InsertedValues[] = [];
  const updated: unknown[] = [];
  const db = {
    select: () => {
      const chain = {
        from: () => chain,
        leftJoin: () => chain,
        where: () => chain,
        limit: () => Promise.resolve(options.conversations.shift() ?? []),
      };
      return chain;
    },
    insert: () => ({
      values: (values: InsertedValues) => {
        inserted.push(values);
        return {
          returning: () =>
            options.failInsert
              ? Promise.reject(options.failInsert)
              : Promise.resolve([options.note ?? noteRow()]),
        };
      },
    }),
    update: () => ({
      set: (values: unknown) => ({
        where: () => {
          updated.push(values);
          return Promise.resolve([]);
        },
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
  const service = new NotesService(
    tenantDb,
    audit as unknown as InboxAuditWriter,
    { publish } as unknown as InboxRealtimeHub,
  );
  return { service, inserted, updated, audit, publish };
}

describe('INBOX-02 private notes', () => {
  it('persists in inbox_private_notes and answers with the note id', async () => {
    const { service, inserted, audit, publish } = buildService({
      conversations: [[conversationRow()]],
    });

    const result = await service.create(memberContext, CONVERSATION_ID, {
      body: 'nota interna',
    });

    expect(inserted).toEqual([
      {
        conversationId: CONVERSATION_ID,
        authorActorId: ACTOR_ID,
        body: 'nota interna',
      },
    ]);
    expect(result).toEqual({
      success: true,
      noteId: NOTE_ID,
      conversationId: CONVERSATION_ID,
      createdAt: '2026-10-28T10:00:00.000Z',
    });
    expect(audit.success).toHaveBeenCalledWith(
      memberContext,
      'inbox.note.created',
      'note',
      NOTE_ID,
    );
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('has no dependency on an outbound channel port', () => {
    // Creating the service with only tenantDb/audit/realtime must be possible;
    // there is no channel parameter to inject at all.
    expect(NotesService.length).toBe(3);
  });

  it('bumps conversation activity so the queue reflects the note', async () => {
    const { service, updated } = buildService({
      conversations: [[conversationRow()]],
    });

    await service.create(memberContext, CONVERSATION_ID, { body: 'nota' });

    expect(updated).toHaveLength(1);
    const bumped = updated[0] as { updatedAt: unknown };
    expect(bumped.updatedAt).toBeInstanceOf(Date);
  });

  it('refuses a conversation outside the member customer_scope', async () => {
    const { service, inserted, audit } = buildService({ conversations: [[]] });

    await expect(
      service.create(memberContext, CONVERSATION_ID, { body: 'nota' }),
    ).rejects.toMatchObject({
      response: { code: 'inbox_conversation_not_found' },
    });
    expect(inserted).toEqual([]);
    expect(audit.success).not.toHaveBeenCalled();
  });

  it('surfaces a persistence failure without auditing success', async () => {
    const { service, audit } = buildService({
      conversations: [[conversationRow()]],
      failInsert: new Error('insert failed'),
    });

    await expect(
      service.create(memberContext, CONVERSATION_ID, { body: 'nota' }),
    ).rejects.toThrow('insert failed');
    expect(audit.success).not.toHaveBeenCalled();
  });
});
