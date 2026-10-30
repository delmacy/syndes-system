import type { TenantContext } from '../../../platform-core/identity/identity.contracts';
import type { TenantCrmDatabase } from '../../../core-crm/tenant-crm.database';
import type { TenantCrmDb } from '../../../core-crm/tenant-crm.database';
import type { InboxAuditWriter } from '../inbox-audit';
import { InboxInboundService } from './inbox-inbound.service';
import { parseChannelInboundEvent } from './inbox-channel.contracts';

const CONTEXT: TenantContext = {
  actorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  tenantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  databaseName: 'sdb_tenant',
  role: 'tenant_member',
  customerScope: 'cpf',
};

const PERSON_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CONVERSATION_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const MESSAGE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const event = parseChannelInboundEvent({
  externalMessageId: 'ext-1',
  senderExternalId: '+5511999999999',
  body: 'Oi',
  occurredAt: '2026-10-29T09:00:00.000Z',
});

function fakeTx(
  reads: unknown[][] = [],
  writes: unknown[][] = [],
): TenantCrmDb {
  let r = 0;
  let w = 0;
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => Promise.resolve(reads[r++] ?? []),
    onConflictDoNothing: () => chain,
    returning: () => Promise.resolve(writes[w++] ?? []),
  };
  const base = {
    select: () => chain,
    insert: () => ({ values: () => chain }),
    update: () => ({ set: () => ({ where: () => chain }) }),
    execute: () => ({ rows: [] }),
  };
  const tx = {
    ...base,
    transaction: (work: (tx: typeof base) => unknown) =>
      Promise.resolve(work(base)),
  };
  return tx as TenantCrmDb;
}

function serviceWith(
  tx: TenantCrmDb,
  successAudit: jest.Mock = jest.fn().mockResolvedValue(undefined),
): { service: InboxInboundService } {
  const audit = { success: successAudit } as unknown as InboxAuditWriter;
  const service = new InboxInboundService(
    {
      withTenant: (_ctx: TenantContext, work: (db: TenantCrmDb) => unknown) =>
        work(tx),
    } as unknown as TenantCrmDatabase,
    audit,
  );
  return { service };
}

type IngestResult = {
  tenantId: string;
  conversationId: string;
  messageId: string;
  duplicate: boolean;
  deliveryStatus: 'dispatched';
};

describe('INBOX-03 inbound channel ingestion (dedupe/order)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ingests a new message, creates the conversation and preserves occurredAt', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const tx = fakeTx(
      [
        [{ personId: PERSON_ID }], // identities
        [], // findByExternalId: no duplicate yet
        [], // existing conversations: none
      ],
      [[{ id: CONVERSATION_ID }], [{ id: MESSAGE_ID }]], // writes
    );
    const successAudit = jest.fn().mockResolvedValue(undefined);
    const { service } = serviceWith(tx, successAudit);

    const result: IngestResult = await service.ingest(
      CONTEXT,
      'whatsapp',
      event,
    );

    expect(result.duplicate).toBe(false);
    expect(result.conversationId).toBe(CONVERSATION_ID);
    expect(result.messageId).toBe(MESSAGE_ID);
    expect(result.deliveryStatus).toBe('dispatched');
    expect(successAudit).toHaveBeenCalledWith(
      CONTEXT,
      'inbox.message.received',
      'message',
      MESSAGE_ID,
    );
  });

  it('deduplicates a replayed external id and never inserts twice', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const tx = fakeTx(
      [
        [{ personId: PERSON_ID }], // identities
        [{ conversationId: CONVERSATION_ID, message: { id: MESSAGE_ID } }], // duplicate found
      ],
      [],
    );
    const { service } = serviceWith(tx);

    const result: IngestResult = await service.ingest(
      CONTEXT,
      'whatsapp',
      event,
    );

    expect(result.duplicate).toBe(true);
    expect(result.messageId).toBe(MESSAGE_ID);
    expect(result.conversationId).toBe(CONVERSATION_ID);
  });

  it('returns 404 when the sender has no CRM channel identity', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const tx = fakeTx([[]]); // no identities
    const { service } = serviceWith(tx);
    await expect(
      service.ingest(CONTEXT, 'whatsapp', event),
    ).rejects.toMatchObject({
      response: { code: 'inbox_channel_identity_not_found' },
    });
  });

  it('falls back to the raced duplicate when the insert loses the race', async () => {
    const reads: unknown[][] = [
      [{ personId: PERSON_ID }], // identities
      [], // findByExternalId #1: none
      [], // existing conversations: none
      [{ conversationId: CONVERSATION_ID, message: { id: MESSAGE_ID } }], // findByExternalId #2
    ];
    const writes: unknown[][] = [[{ id: CONVERSATION_ID }], []]; // insert conv, then empty insert msg
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const tx = fakeTx(reads, writes);
    const { service } = serviceWith(tx);

    const result: IngestResult = await service.ingest(
      CONTEXT,
      'whatsapp',
      event,
    );

    expect(result.duplicate).toBe(true);
    expect(result.messageId).toBe(MESSAGE_ID);
  });
});
