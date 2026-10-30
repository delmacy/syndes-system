/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method */
import type { TenantContext } from '../../../platform-core/identity/identity.contracts';
import type { TenantCrmDatabase } from '../../../core-crm/tenant-crm.database';
import type { TenantCrmDb } from '../../../core-crm/tenant-crm.database';
import type { InboxAuditWriter } from '../inbox-audit';
import { ChannelIngressService } from './channel-ingress.service';
import type { InboxChannelRegistry } from './inbox-channel-registry';
import type { ChannelBindingRecord } from './inbox-channel-registry';
import { parseChannelInboundEvent } from './inbox-channel.contracts';

const BINDING_TOKEN = 'tok-tenant-a-whatsapp';
const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DATABASE_NAME = 'sdb_tenant_a';

const binding: ChannelBindingRecord = {
  bindingToken: BINDING_TOKEN,
  tenantId: TENANT_ID,
  databaseName: DATABASE_NAME,
  productChannel: 'whatsapp',
};

const event = parseChannelInboundEvent({
  externalMessageId: 'ext-1',
  senderExternalId: '+5511999999999',
  body: 'Oi',
});

function registryWith(resolved: ChannelBindingRecord | null) {
  return {
    resolve: jest.fn(() => resolved),
  } as unknown as InboxChannelRegistry;
}

function dbWith(rowsByCall: unknown[][] = []) {
  let i = 0;
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => Promise.resolve(rowsByCall[i++] ?? []),
    returning: () => Promise.resolve(rowsByCall[i++] ?? []),
  };
  const base = {
    select: () => chain,
    insert: () => ({ values: () => chain }),
    update: () => ({ set: () => ({ where: () => chain }) }),
  };
  const db = { ...base };
  return db as unknown as TenantCrmDb;
}

function serviceWith(
  binding: ChannelBindingRecord | null,
  dbRows: unknown[][] = [],
  channelAudit: jest.Mock = jest.fn().mockResolvedValue(undefined),
) {
  const audit = { channel: channelAudit } as unknown as InboxAuditWriter;
  return new ChannelIngressService(
    {
      withTenant: (_ctx: TenantContext, work: (db: TenantCrmDb) => unknown) =>
        work(dbWith(dbRows)),
    } as unknown as TenantCrmDatabase,
    registryWith(binding),
    audit,
  );
}

describe('INBOX-03 channel ingress (binding/dedupe)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects an unknown binding token without touching a database', async () => {
    const service = serviceWith(null);
    const ingest = service.ingest.bind(service);
    await expect(ingest(BINDING_TOKEN, event)).rejects.toMatchObject({
      response: { code: 'inbox_channel_binding_not_found' },
    });
  });

  it('ingests a new event through the binding tenant and audits the channel event', async () => {
    const dbRows: unknown[][] = [
      [], // no existing message (dedupe miss)
      [], // no channel identity person
      [], // no existing conversation
      [{ id: 'conv-1' }], // insert conversation
      [{ id: 'msg-1' }], // insert message
    ];
    const channelAudit = jest.fn().mockResolvedValue(undefined);
    const service = serviceWith(binding, dbRows, channelAudit);
    const ingest = service.ingest.bind(service);

    const result = await ingest(BINDING_TOKEN, event);

    expect(result.duplicate).toBe(false);
    expect(result.tenantId).toBe(TENANT_ID);
    expect(result.conversationId).toBe('conv-1');
    expect(result.messageId).toBe('msg-1');
    expect(channelAudit).toHaveBeenCalledWith(
      TENANT_ID,
      'inbox.channel.message.received',
      'success',
      'msg-1',
    );
  });

  it('deduplicates a replayed external id and audits it as duplicated', async () => {
    const dbRows: unknown[][] = [[{ id: 'msg-1', conversationId: 'conv-1' }]]; // dedupe hit
    const channelAudit = jest.fn().mockResolvedValue(undefined);
    const service = serviceWith(binding, dbRows, channelAudit);
    const ingest = service.ingest.bind(service);

    const result = await ingest(BINDING_TOKEN, event);

    expect(result.duplicate).toBe(true);
    expect(result.messageId).toBe('msg-1');
    expect(result.conversationId).toBe('conv-1');
    expect(channelAudit).toHaveBeenCalledWith(
      TENANT_ID,
      'inbox.channel.message.duplicated',
      'success',
      'msg-1',
    );
  });
});
