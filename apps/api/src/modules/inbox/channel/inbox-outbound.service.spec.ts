/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method */
import type { TenantContext } from '../../../platform-core/identity/identity.contracts';
import type { TenantCrmDatabase } from '../../../core-crm/tenant-crm.database';
import type { TenantCrmDb } from '../../../core-crm/tenant-crm.database';
import type { InboxAuditWriter } from '../inbox-audit';
import { InboxOutboundService } from './inbox-outbound.service';

const CONTEXT: TenantContext = {
  actorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  tenantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  databaseName: 'sdb_tenant',
  role: 'tenant_member',
  customerScope: 'cpf',
};

const MESSAGE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CONVERSATION_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function messageRow(deliveryStatus: 'pending' | 'dispatched' | 'failed') {
  return {
    id: MESSAGE_ID,
    conversationId: CONVERSATION_ID,
    direction: 'outbound' as const,
    body: 'Oi',
    deliveryStatus,
    externalId: null,
  };
}

function conversationRow(
  channel: 'whatsapp' | 'email' | 'unknown' = 'whatsapp',
  personId: string | null = 'person-1',
) {
  return { id: CONVERSATION_ID, channel, personId };
}

function fakeTx(reads: unknown[][] = [], writes: unknown[][] = []) {
  let r = 0;
  let w = 0;
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => Promise.resolve(reads[r++] ?? []),
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
  return tx as unknown as TenantCrmDb;
}

function serviceWith(tx: TenantCrmDb) {
  const successAudit = jest.fn().mockResolvedValue(undefined);
  const failureAudit = jest.fn().mockResolvedValue(undefined);
  const audit = {
    success: successAudit,
    failure: failureAudit,
  } as unknown as InboxAuditWriter;
  const service = new InboxOutboundService(
    {
      withTenant: (_ctx: TenantContext, work: (db: TenantCrmDb) => unknown) =>
        work(tx),
    } as unknown as TenantCrmDatabase,
    audit,
  );
  return { service, successAudit, failureAudit };
}

describe('INBOX-03 outbound delivery (retry/order honesty)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('dispatches a pending message and persists the provider result', async () => {
    const port = {
      dispatchOutbound: jest.fn().mockResolvedValue({
        deliveryStatus: 'dispatched',
        externalId: 'prov-1',
      }),
    };
    const tx = fakeTx(
      [
        [{ message: messageRow('pending'), conversation: conversationRow() }],
        [{ externalId: 'person-1' }],
      ],
      [
        [
          {
            id: MESSAGE_ID,
            deliveryStatus: 'dispatched',
            externalId: 'prov-1',
          },
        ],
      ],
    );
    const { service, successAudit } = serviceWith(tx);

    const result = await service.dispatch(CONTEXT, MESSAGE_ID, port);

    expect(result.deliveryStatus).toBe('dispatched');
    expect(result.externalId).toBe('prov-1');
    expect(port.dispatchOutbound).toHaveBeenCalledTimes(1);
    expect(successAudit).toHaveBeenCalledWith(
      CONTEXT,
      'inbox.message.dispatched',
      'message',
      MESSAGE_ID,
    );
  });

  it('returns an already-dispatched message idempotently without calling the adapter', async () => {
    const port = { dispatchOutbound: jest.fn() };
    const tx = fakeTx([
      [{ message: messageRow('dispatched'), conversation: conversationRow() }],
    ]);
    const { service } = serviceWith(tx);

    const result = await service.dispatch(CONTEXT, MESSAGE_ID, port);

    expect(result.deliveryStatus).toBe('dispatched');
    expect(port.dispatchOutbound).not.toHaveBeenCalled();
  });

  it('retries only a failed message', async () => {
    const port = {
      dispatchOutbound: jest.fn().mockResolvedValue({
        deliveryStatus: 'dispatched',
        externalId: 'prov-2',
      }),
    };
    const tx = fakeTx(
      [
        [{ message: messageRow('failed'), conversation: conversationRow() }],
        [{ externalId: 'person-1' }],
      ],
      [
        [
          {
            id: MESSAGE_ID,
            deliveryStatus: 'dispatched',
            externalId: 'prov-2',
          },
        ],
      ],
    );
    const { service } = serviceWith(tx);

    const result = await service.retry(CONTEXT, MESSAGE_ID, port);

    expect(result.deliveryStatus).toBe('dispatched');
    expect(port.dispatchOutbound).toHaveBeenCalledTimes(1);
  });

  it('rejects retry of a dispatched message (not retryable)', async () => {
    const port = { dispatchOutbound: jest.fn() };
    const tx = fakeTx([
      [{ message: messageRow('dispatched'), conversation: conversationRow() }],
    ]);
    const { service } = serviceWith(tx);

    await expect(
      service.retry(CONTEXT, MESSAGE_ID, port),
    ).rejects.toMatchObject({
      response: { code: 'inbox_message_not_retryable' },
    });
    expect(port.dispatchOutbound).not.toHaveBeenCalled();
  });

  it('rejects retry of a pending message (only failed is retryable)', async () => {
    const port = { dispatchOutbound: jest.fn() };
    const tx = fakeTx([
      [{ message: messageRow('pending'), conversation: conversationRow() }],
    ]);
    const { service } = serviceWith(tx);

    await expect(
      service.retry(CONTEXT, MESSAGE_ID, port),
    ).rejects.toMatchObject({
      response: { code: 'inbox_message_not_retryable' },
    });
    expect(port.dispatchOutbound).not.toHaveBeenCalled();
  });

  it('marks a message failed when the channel has no recipient', async () => {
    const port = { dispatchOutbound: jest.fn() };
    const tx = fakeTx([
      [
        {
          message: messageRow('pending'),
          conversation: conversationRow('unknown'),
        },
      ],
    ]);
    const { service, failureAudit } = serviceWith(tx);

    const result = await service.dispatch(CONTEXT, MESSAGE_ID, port);

    expect(result.deliveryStatus).toBe('failed');
    expect(result.failureReason).toBe('channel_unavailable');
    expect(port.dispatchOutbound).not.toHaveBeenCalled();
    expect(failureAudit).toHaveBeenCalledWith(
      CONTEXT,
      'inbox.message.delivery_failed',
      'message',
      MESSAGE_ID,
    );
  });

  it('marks a message failed when the provider errors', async () => {
    const port = {
      dispatchOutbound: jest.fn().mockResolvedValue({
        deliveryStatus: 'failed',
        failureReason: 'provider_error',
      }),
    };
    const tx = fakeTx(
      [
        [{ message: messageRow('pending'), conversation: conversationRow() }],
        [{ externalId: 'person-1' }],
      ],
      [[{ id: MESSAGE_ID, deliveryStatus: 'failed' }]],
    );
    const { service } = serviceWith(tx);

    const result = await service.dispatch(CONTEXT, MESSAGE_ID, port);

    expect(result.deliveryStatus).toBe('failed');
    expect(result.failureReason).toBe('provider_error');
  });
});
