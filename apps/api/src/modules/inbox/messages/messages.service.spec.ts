import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import type {
  TenantCrmDatabase,
  TenantCrmDb,
} from '../../core-crm/tenant-crm.database';
import type { InboxAuditWriter } from '../inbox-audit';
import type { ChannelOutboundService } from '../channel/channel-outbound.service';
import type { InboxRealtimeHub } from '../realtime/inbox-realtime.hub';
import { MessagesService, toTimelineEntry } from './messages.service';

const CONVERSATION_ID = '11111111-1111-4111-8111-111111111111';
const MESSAGE_ID = '22222222-2222-4222-8222-222222222222';
const ACTOR_ID = '33333333-3333-4333-8333-333333333333';

const memberContext: TenantContext = {
  actorId: ACTOR_ID,
  tenantId: '44444444-4444-4444-8444-444444444444',
  databaseName: 'sdb_tenant',
  role: 'tenant_member',
  customerScope: 'cpf',
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

type QueueItem<T> = T | Error;

interface FakeDbConfig {
  conversations?: QueueItem<unknown[]>[];
  idempotency?: QueueItem<unknown[]>[];
  execute?: QueueItem<{ rows: unknown[] }>[];
  insert?: QueueItem<unknown[]>[];
  update?: QueueItem<unknown[]>[];
}

function next<T>(queue: QueueItem<T>[] | undefined, label: string): Promise<T> {
  if (!queue || queue.length === 0) {
    return Promise.reject(new Error(`Unexpected ${label} call`));
  }
  const item = queue.shift() as QueueItem<T>;
  if (item instanceof Error) return Promise.reject(item);
  return Promise.resolve(item);
}

function fakeDb(config: FakeDbConfig) {
  const db = {
    select: () => {
      let joined = false;
      const chain = {
        from: () => chain,
        leftJoin: () => {
          joined = true;
          return chain;
        },
        where: () => chain,
        limit: () =>
          joined
            ? next(config.conversations, 'conversation lookup')
            : next(config.idempotency, 'idempotency lookup'),
      };
      return chain;
    },
    execute: () => next(config.execute, 'execute'),
    insert: () => ({
      values: () => ({
        returning: () => next(config.insert, 'insert returning'),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => next(config.update, 'update'),
      }),
    }),
  };
  return db as unknown as TenantCrmDb;
}

function serviceWith(
  config: FakeDbConfig,
  options: {
    deliver?: jest.Mock;
    audit?: { success: jest.Mock; failure: jest.Mock };
    publish?: jest.Mock;
  } = {},
) {
  const deliver =
    options.deliver ??
    jest.fn((_c: TenantContext, _ch: string, message: unknown) =>
      Promise.resolve(message),
    );
  const audit = options.audit ?? {
    success: jest.fn().mockResolvedValue(undefined),
    failure: jest.fn().mockResolvedValue(undefined),
  };
  const publish = options.publish ?? jest.fn().mockResolvedValue(undefined);
  const tenantDb = {
    withTenant: (_context: TenantContext, run: (db: TenantCrmDb) => unknown) =>
      run(fakeDb(config)),
  } as unknown as TenantCrmDatabase;
  const service = new MessagesService(
    tenantDb,
    { deliverPublicReply: deliver } as unknown as ChannelOutboundService,
    audit as unknown as InboxAuditWriter,
    { publish } as unknown as InboxRealtimeHub,
  );
  return { service, deliver, audit, publish };
}

function messageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: MESSAGE_ID,
    conversationId: CONVERSATION_ID,
    direction: 'outbound',
    body: 'Olá',
    authorActorId: ACTOR_ID,
    authorExternalId: null,
    deliveryStatus: 'pending',
    sourceChannel: 'whatsapp',
    externalId: null,
    idempotencyKey: 'key-1',
    createdAt: new Date('2026-10-28T10:00:00.000Z'),
    ...overrides,
  };
}

describe('INBOX-02 toTimelineEntry', () => {
  it('maps an inbound message to a customer-authored entry', () => {
    expect(
      toTimelineEntry({
        id: 'm1',
        record_type: 'message',
        direction: 'inbound',
        body: 'Oi',
        author_actor_id: null,
        delivery_status: null,
        external_id: 'ext-1',
        created_at: '2026-10-28T10:00:00.000Z',
      }),
    ).toEqual({
      id: 'm1',
      kind: 'inbound',
      content: 'Oi',
      author: { role: 'customer', name: null, actorId: null },
      createdAt: '2026-10-28T10:00:00.000Z',
      deliveryStatus: 'pending',
      direction: 'inbound',
      externalId: 'ext-1',
    });
  });

  it('maps an outbound message with its persisted delivery state', () => {
    expect(
      toTimelineEntry({
        id: 'm2',
        record_type: 'message',
        direction: 'outbound',
        body: 'Resposta',
        author_actor_id: ACTOR_ID,
        delivery_status: 'dispatched',
        external_id: null,
        created_at: new Date('2026-10-28T10:00:00.000Z'),
      }),
    ).toMatchObject({
      kind: 'outgoing',
      deliveryStatus: 'dispatched',
      direction: 'outbound',
      author: { role: 'agent', actorId: ACTOR_ID },
    });
  });

  it('maps a private note without any delivery state', () => {
    const entry = toTimelineEntry({
      id: 'n1',
      record_type: 'note',
      direction: 'note',
      body: 'nota interna',
      author_actor_id: ACTOR_ID,
      delivery_status: null,
      external_id: null,
      created_at: '2026-10-28T10:00:00.000Z',
    });
    expect(entry).toEqual({
      id: 'n1',
      kind: 'note',
      content: 'nota interna',
      author: { role: 'agent', name: null, actorId: ACTOR_ID },
      createdAt: '2026-10-28T10:00:00.000Z',
      direction: 'note',
    });
    expect(entry.deliveryStatus).toBeUndefined();
  });
});

describe('INBOX-02 message history', () => {
  it('returns the merged timeline ordered by (created_at, id)', async () => {
    const historyRows = [
      {
        id: 'a',
        record_type: 'message',
        direction: 'inbound',
        body: 'primeiro',
        author_actor_id: null,
        delivery_status: null,
        external_id: 'ext-a',
        created_at: '2026-10-28T10:00:00.123456Z',
      },
      {
        id: 'b',
        record_type: 'note',
        direction: 'note',
        body: 'nota',
        author_actor_id: ACTOR_ID,
        delivery_status: null,
        external_id: null,
        created_at: '2026-10-28T10:00:00.123457Z',
      },
      {
        id: 'c',
        record_type: 'message',
        direction: 'outbound',
        body: 'terceiro',
        author_actor_id: ACTOR_ID,
        delivery_status: 'dispatched',
        external_id: null,
        created_at: '2026-10-28T10:00:01.000000Z',
      },
    ];
    const { service } = serviceWith({
      conversations: [[conversationRow()]],
      execute: [{ rows: historyRows }],
    });

    const entries = await service.list(memberContext, CONVERSATION_ID, {
      limit: 50,
    });

    expect(entries.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
    expect(entries.map((entry) => entry.kind)).toEqual([
      'inbound',
      'note',
      'outgoing',
    ]);
  });

  it('resolves an id cursor and applies a strict tuple comparison', async () => {
    const { service } = serviceWith({
      conversations: [[conversationRow()]],
      execute: [
        {
          rows: [
            {
              id: 'b',
              created_at: '2026-10-28T10:00:00.123457Z',
            },
          ],
        },
        { rows: [] },
      ],
    });

    const entries = await service.list(memberContext, CONVERSATION_ID, {
      after: 'b',
      limit: 50,
    });

    expect(entries).toEqual([]);
  });

  it('maps an unknown cursor to a stable not-found problem', async () => {
    const { service } = serviceWith({
      conversations: [[conversationRow()]],
      execute: [{ rows: [] }],
    });

    await expect(
      service.list(memberContext, CONVERSATION_ID, {
        after: 'missing',
        limit: 50,
      }),
    ).rejects.toMatchObject({
      response: { code: 'inbox_message_cursor_not_found' },
    });
  });

  it('never reads history for a conversation outside customer_scope', async () => {
    const { service } = serviceWith({ conversations: [[]] });

    await expect(
      service.list(memberContext, CONVERSATION_ID, { limit: 50 }),
    ).rejects.toMatchObject({
      response: { code: 'inbox_conversation_not_found' },
    });
  });
});

describe('INBOX-02 public reply delivery honesty', () => {
  it('persists pending first, then reports the adapter-confirmed state', async () => {
    const message = messageRow();
    const deliver = jest.fn(
      (_c: TenantContext, _ch: string, row: Record<string, unknown>) =>
        Promise.resolve({
          ...row,
          deliveryStatus: 'dispatched',
          externalId: 'provider-1',
        }),
    );
    const { service, audit, publish } = serviceWith(
      {
        conversations: [[conversationRow()]],
        idempotency: [[]],
        insert: [[message]],
        update: [[]],
      },
      { deliver },
    );

    const result = await service.create(
      memberContext,
      CONVERSATION_ID,
      { body: 'Olá' },
      'key-1',
    );

    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver.mock.calls[0][1]).toBe('whatsapp');
    expect(audit.success).toHaveBeenCalledWith(
      memberContext,
      'inbox.message.created',
      'message',
      MESSAGE_ID,
    );
    expect(publish).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      success: true,
      messageId: MESSAGE_ID,
      deliveryStatus: 'dispatched',
      externalId: 'provider-1',
      createdAt: '2026-10-28T10:00:00.000Z',
    });
  });

  it('stays honest as pending when no adapter is configured', async () => {
    const message = messageRow();
    const { service } = serviceWith({
      conversations: [[conversationRow()]],
      idempotency: [[]],
      insert: [[message]],
      update: [[]],
    });

    const result = await service.create(
      memberContext,
      CONVERSATION_ID,
      { body: 'Olá' },
      'key-1',
    );

    expect(result.deliveryStatus).toBe('pending');
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('reports a failed delivery without claiming success', async () => {
    const message = messageRow();
    const deliver = jest.fn(
      (_c: TenantContext, _ch: string, row: Record<string, unknown>) =>
        Promise.resolve({
          ...row,
          deliveryStatus: 'failed',
        }),
    );
    const { service, audit } = serviceWith(
      {
        conversations: [[conversationRow()]],
        idempotency: [[]],
        insert: [[message]],
        update: [[]],
      },
      { deliver },
    );

    const result = await service.create(
      memberContext,
      CONVERSATION_ID,
      { body: 'Olá' },
      'key-1',
    );

    expect(result).toMatchObject({
      success: false,
      deliveryStatus: 'failed',
      error: 'delivery_failed',
    });
    expect(audit.failure).toHaveBeenCalledWith(
      memberContext,
      'inbox.message.delivery_failed',
      'message',
      MESSAGE_ID,
    );
  });

  it('replays an Idempotency-Key without inserting or re-auditing creation', async () => {
    const message = messageRow({ deliveryStatus: 'dispatched' });
    const deliver = jest.fn((_c: TenantContext, _ch: string, row: unknown) =>
      Promise.resolve(row),
    );
    const { service, audit } = serviceWith(
      {
        conversations: [[conversationRow()]],
        idempotency: [[message]],
      },
      { deliver },
    );

    const result = await service.create(
      memberContext,
      CONVERSATION_ID,
      { body: 'Olá' },
      'key-1',
    );

    expect(result.messageId).toBe(MESSAGE_ID);
    expect(result.deliveryStatus).toBe('dispatched');
    expect(audit.success).not.toHaveBeenCalledWith(
      memberContext,
      'inbox.message.created',
      'message',
      MESSAGE_ID,
    );
  });

  it('reconciles a concurrent insert race (23505) to the persisted row', async () => {
    const existing = messageRow({ deliveryStatus: 'pending' });
    const raceError = Object.assign(new Error('duplicate key'), {
      code: '23505',
    });
    const { service } = serviceWith({
      conversations: [[conversationRow()]],
      idempotency: [[], [existing]],
      insert: [raceError],
    });

    const result = await service.create(
      memberContext,
      CONVERSATION_ID,
      { body: 'Olá' },
      'key-1',
    );

    expect(result.messageId).toBe(MESSAGE_ID);
  });

  it('persists the source channel only for a known product channel', async () => {
    const message = messageRow({ sourceChannel: null });
    const values: Record<string, unknown>[] = [];
    const config: FakeDbConfig = {
      conversations: [[conversationRow({ channel: 'unknown' })]],
      idempotency: [[]],
      update: [[]],
    };
    const tenantDb = {
      withTenant: (_c: TenantContext, run: (db: TenantCrmDb) => unknown) =>
        run({
          ...fakeDb({
            ...config,
            insert: [[message]],
          }),
          insert: () => ({
            values: (row: Record<string, unknown>) => {
              values.push(row);
              return { returning: () => Promise.resolve([message]) };
            },
          }),
        } as unknown as TenantCrmDb),
    } as unknown as TenantCrmDatabase;
    const service = new MessagesService(
      tenantDb,
      {
        deliverPublicReply: jest.fn(
          (_c: TenantContext, _ch: string, row: unknown) =>
            Promise.resolve(row),
        ),
      } as unknown as ChannelOutboundService,
      {
        success: jest.fn().mockResolvedValue(undefined),
        failure: jest.fn().mockResolvedValue(undefined),
      } as unknown as InboxAuditWriter,
    );

    await service.create(
      memberContext,
      CONVERSATION_ID,
      { body: 'Olá' },
      'key-1',
    );

    expect(values[0]).toMatchObject({
      direction: 'outbound',
      deliveryStatus: 'pending',
    });
    expect(values[0]).not.toHaveProperty('sourceChannel');
  });

  it('does not persist a reply for an invisible conversation', async () => {
    const deliver = jest.fn();
    const { service } = serviceWith({ conversations: [[]] }, { deliver });

    await expect(
      service.create(memberContext, CONVERSATION_ID, { body: 'Olá' }, 'key-1'),
    ).rejects.toMatchObject({
      response: { code: 'inbox_conversation_not_found' },
    });
    expect(deliver).not.toHaveBeenCalled();
  });

  it('audits a delivery failure thrown by the channel port and rethrows', async () => {
    const message = messageRow();
    const deliver = jest.fn(() =>
      Promise.reject(new Error('adapter exploded')),
    );
    const { service, audit } = serviceWith(
      {
        conversations: [[conversationRow()]],
        idempotency: [[]],
        insert: [[message]],
        update: [[]],
      },
      { deliver },
    );

    await expect(
      service.create(memberContext, CONVERSATION_ID, { body: 'Olá' }, 'key-1'),
    ).rejects.toThrow('adapter exploded');
    expect(audit.failure).toHaveBeenCalledWith(
      memberContext,
      'inbox.message.delivery_failed',
      'message',
      MESSAGE_ID,
    );
  });
});
