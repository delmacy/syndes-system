/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { notFoundProblem } from '../../core-crm/crm-problem-details';
import type { TenantContext } from '../../../platform-core/identity/identity.contracts';
import type { TenantCrmDatabase } from '../../../core-crm/tenant-crm.database';
import type { TenantCrmDb } from '../../../core-crm/tenant-crm.database';
import type { InboxAuditWriter } from '../inbox-audit';
import type { InboxRealtimeHub } from '../realtime/inbox-realtime.hub';
import { InboxAttachmentsService } from './inbox-attachments.service';
import type { InboxAttachmentStorage } from './inbox-attachment.storage';
import { InboxAttachmentIntegrityError } from './inbox-attachment.storage';

jest.mock('../conversations/conversations.service', () => ({
  loadVisibleConversation: jest.fn(),
}));
import { loadVisibleConversation } from '../conversations/conversations.service';

const CONVERSATION_ID = '11111111-1111-4111-8111-111111111111';
const ATTACHMENT_ID = '22222222-2222-4222-8222-222222222222';
const ACTOR_ID = '33333333-3333-4333-8333-333333333333';
const TENANT_ID = '44444444-4444-4444-8444-444444444444';

const context: TenantContext = {
  actorId: ACTOR_ID,
  tenantId: TENANT_ID,
  databaseName: 'sdb_tenant',
  role: 'tenant_member',
  customerScope: 'cpf',
};

const conversationResource = {
  id: CONVERSATION_ID,
  personId: '55555555-5555-4555-8555-555555555555',
  organizationId: null,
  status: 'open',
  assigneeActorId: null,
  channel: 'whatsapp',
  createdAt: new Date('2026-10-28T09:00:00.000Z'),
  updatedAt: new Date('2026-10-28T09:00:00.000Z'),
};

const validUpload = {
  originalname: 'foto.png',
  mimetype: 'image/png',
  size: 16,
  buffer: Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
  ]),
};

type CreateResult = {
  id: string;
  conversationId: string;
};

type DownloadResult = {
  attachment: { id: string };
  bytes: Buffer;
};

function serviceWith(
  storage: InboxAttachmentStorage,
  db: TenantCrmDb,
  successAudit: jest.Mock,
  realtime: InboxRealtimeHub | undefined,
) {
  const audit = { success: successAudit } as unknown as InboxAuditWriter;
  const service = new InboxAttachmentsService(
    {
      withTenant: (_ctx: TenantContext, work: (db: TenantCrmDb) => unknown) =>
        work(db),
    } as unknown as TenantCrmDatabase,
    storage,
    {
      storageRoot: 'var/inbox-attachments',
      maxBytes: 10 * 1024 * 1024,
      allowedTypes: new Map([['image/png', ['png'] as const]]),
    },
    audit,
    realtime,
  );
  return { service };
}

describe('INBOX-04 attachment service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates an attachment, audits and publishes when the conversation is visible', async () => {
    (loadVisibleConversation as jest.Mock).mockResolvedValue(
      conversationResource,
    );
    const createObjectKeyMock = jest.fn(() => `${TENANT_ID}/key.png`);
    const writeMock = jest.fn().mockResolvedValue(undefined);
    const removeMock = jest.fn().mockResolvedValue(undefined);
    const storage = {
      createObjectKey: createObjectKeyMock,
      write: writeMock,
      remove: removeMock,
    } as unknown as InboxAttachmentStorage;
    const db = {
      insert: () => ({
        values: () => ({
          returning: () =>
            Promise.resolve([
              {
                id: ATTACHMENT_ID,
                conversationId: CONVERSATION_ID,
                createdAt: new Date('2026-10-28T10:00:00.000Z'),
              },
            ]),
        }),
      }),
    } as unknown as TenantCrmDb;
    const successAudit = jest.fn().mockResolvedValue(undefined);
    const realtime = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as unknown as InboxRealtimeHub;

    const { service } = serviceWith(storage, db, successAudit, realtime);

    const result: CreateResult = await service.create(
      context,
      CONVERSATION_ID,
      validUpload,
    );

    expect(result.id).toBe(ATTACHMENT_ID);
    expect(result.conversationId).toBe(CONVERSATION_ID);
    expect(createObjectKeyMock).toHaveBeenCalledWith(context, 'png');
    expect(writeMock).toHaveBeenCalled();
    expect(successAudit).toHaveBeenCalledWith(
      context,
      'inbox.attachment.created',
      'attachment',
      ATTACHMENT_ID,
    );

    expect(realtime.publish).toHaveBeenCalledTimes(1);
  });

  it('removes the orphaned object when the metadata insert fails', async () => {
    (loadVisibleConversation as jest.Mock).mockResolvedValue(
      conversationResource,
    );
    const createObjectKeyMock = jest.fn(() => `${TENANT_ID}/key.png`);
    const writeMock = jest.fn().mockResolvedValue(undefined);
    const removeMock = jest.fn().mockResolvedValue(undefined);
    const storage = {
      createObjectKey: createObjectKeyMock,
      write: writeMock,
      remove: removeMock,
    } as unknown as InboxAttachmentStorage;
    const db = {
      insert: () => ({
        values: () => ({
          returning: () => Promise.reject(new Error('insert failed')),
        }),
      }),
    } as unknown as TenantCrmDb;
    const successAudit = jest.fn().mockResolvedValue(undefined);

    const { service } = serviceWith(storage, db, successAudit, undefined);

    await expect(
      service.create(context, CONVERSATION_ID, validUpload),
    ).rejects.toThrow('insert failed');
    expect(removeMock).toHaveBeenCalledWith(context, `${TENANT_ID}/key.png`);
  });

  it('downloads bytes after verifying integrity', async () => {
    const attachment = {
      id: ATTACHMENT_ID,
      conversationId: CONVERSATION_ID,
      objectKey: `${TENANT_ID}/key.png`,
      originalFilename: 'foto.png',
      contentType: 'image/png',
      byteSize: 41,
      sha256: 'abc',
      createdAt: new Date(),
    };
    const bytes = Buffer.from('bytes');
    (loadVisibleConversation as jest.Mock).mockResolvedValue(
      conversationResource,
    );
    const readMock = jest.fn().mockResolvedValue(bytes);
    const storage = { read: readMock } as unknown as InboxAttachmentStorage;
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([attachment]) }),
        }),
      }),
    } as unknown as TenantCrmDb;

    const { service } = serviceWith(
      storage,
      db,
      jest.fn().mockResolvedValue(undefined),
      undefined,
    );

    const result: DownloadResult = await service.download(
      context,
      ATTACHMENT_ID,
    );
    expect(result.bytes).toEqual(bytes);
    expect(result.attachment.id).toBe(ATTACHMENT_ID);
    expect(readMock).toHaveBeenCalledWith(context, `${TENANT_ID}/key.png`, {
      byteSize: 41,
      sha256: 'abc',
    });
  });

  it('returns 404 when the attachment does not exist', async () => {
    const readMock = jest.fn();
    const storage = { read: readMock } as unknown as InboxAttachmentStorage;
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([]) }),
        }),
      }),
    } as unknown as TenantCrmDb;
    await expect(
      serviceWith(
        storage,
        db,
        jest.fn().mockResolvedValue(undefined),
        undefined,
      ).service.download(context, 'missing-id'),
    ).rejects.toMatchObject({
      response: { code: 'inbox_attachment_not_found' },
    });
    expect(readMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the attachment conversation is invisible (cross-tenant = 404)', async () => {
    (loadVisibleConversation as jest.Mock).mockRejectedValue(
      notFoundProblem('inbox_conversation_not_found'),
    );
    const readMock = jest.fn();
    const storage = { read: readMock } as unknown as InboxAttachmentStorage;
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ id: ATTACHMENT_ID }]),
          }),
        }),
      }),
    } as unknown as TenantCrmDb;
    await expect(
      serviceWith(
        storage,
        db,
        jest.fn().mockResolvedValue(undefined),
        undefined,
      ).service.download(context, ATTACHMENT_ID),
    ).rejects.toMatchObject({
      response: { code: 'inbox_conversation_not_found' },
    });
    expect(readMock).not.toHaveBeenCalled();
  });

  it('maps storage integrity failure to 404 without leaking details', async () => {
    const attachment = {
      id: ATTACHMENT_ID,
      conversationId: CONVERSATION_ID,
      objectKey: `${TENANT_ID}/key.png`,
      originalFilename: 'foto.png',
      contentType: 'image/png',
      byteSize: 41,
      sha256: 'abc',
      createdAt: new Date(),
    };
    (loadVisibleConversation as jest.Mock).mockResolvedValue(
      conversationResource,
    );
    const readMock = jest
      .fn()
      .mockRejectedValue(new InboxAttachmentIntegrityError());
    const storage = { read: readMock } as unknown as InboxAttachmentStorage;
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([attachment]) }),
        }),
      }),
    } as unknown as TenantCrmDb;
    await expect(
      serviceWith(
        storage,
        db,
        jest.fn().mockResolvedValue(undefined),
        undefined,
      ).service.download(context, ATTACHMENT_ID),
    ).rejects.toMatchObject({
      response: { code: 'inbox_attachment_not_found' },
    });
  });
});
