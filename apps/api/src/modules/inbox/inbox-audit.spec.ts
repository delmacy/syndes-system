import { Logger } from '@nestjs/common';
import type {
  AuditEventInput,
  AuditService,
} from '../platform-core/identity/audit.service';
import type { TenantContext } from '../platform-core/identity/identity.contracts';
import { InboxAuditWriter } from './inbox-audit';

const context: TenantContext = {
  actorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  tenantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  databaseName: 'sdb_tenant',
  role: 'tenant_member',
  customerScope: 'cpf',
};

type RecordMock = jest.Mock<Promise<void>, [AuditEventInput]>;

function writer(record?: RecordMock) {
  const mock = record ?? jest.fn<Promise<void>, [AuditEventInput]>();
  if (!record) mock.mockResolvedValue(undefined);
  const audit = { record: mock } as unknown as AuditService;
  return { writer: new InboxAuditWriter(audit), record: mock };
}

describe('InboxAuditWriter', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('writes an allowlisted success record to the Control Plane audit', async () => {
    const { writer: auditWriter, record } = writer();
    await auditWriter.success(
      context,
      'inbox.message.created',
      'message',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    );
    expect(record).toHaveBeenCalledWith({
      tenantId: context.tenantId,
      actorId: context.actorId,
      action: 'inbox.message.created',
      resourceType: 'message',
      resourceId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      result: 'success',
    });
  });

  it('records denied and failed actions with the same classification', async () => {
    const { writer: auditWriter, record } = writer();
    await auditWriter.denied(
      context,
      'inbox.conversation.assigned',
      'conversation',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    );
    await auditWriter.failure(
      context,
      'inbox.message.delivery_failed',
      'message',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    );
    expect(record.mock.calls.map(([event]) => event.result)).toEqual([
      'denied',
      'failure',
    ]);
  });

  it('records actor-less channel events with the trusted tenant id', async () => {
    const { writer: auditWriter, record } = writer();
    await auditWriter.channel(
      context.tenantId,
      'inbox.channel.message.received',
      'success',
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
    );
    expect(record).toHaveBeenCalledWith({
      tenantId: context.tenantId,
      action: 'inbox.channel.message.received',
      resourceType: 'channel_message',
      resourceId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      result: 'success',
    });
    const [event] = record.mock.calls[0];
    expect(event.actorId).toBeUndefined();
  });

  it('never sends message or note content to the audit record', async () => {
    const { writer: auditWriter, record } = writer();
    await auditWriter.success(context, 'inbox.note.created', 'note', 'note-id');
    const serialized = JSON.stringify(record.mock.calls);
    for (const forbidden of [
      'private note body',
      'customer message body',
      'postgresql://',
      'password',
      'token',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('is best-effort: an audit write failure never breaks the caller', async () => {
    const record = jest.fn<Promise<void>, [AuditEventInput]>();
    record.mockRejectedValue(new Error('control plane down'));
    const { writer: auditWriter } = writer(record);
    await expect(
      auditWriter.success(context, 'inbox.message.created', 'message', 'id'),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('details withheld'),
    );
  });
});
