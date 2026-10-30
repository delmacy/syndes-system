import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import { notFoundProblem } from '../../core-crm/crm-problem-details';
import { TenantCrmDatabase } from '../../core-crm/tenant-crm.database';
import { InboxAuditWriter } from '../inbox-audit';
import { loadVisibleConversation } from '../conversations/conversations.service';
import { inboxAttachments } from '../inbox.schema';
import { InboxRealtimeHub } from '../realtime/inbox-realtime.hub';
import { createInboxRealtimeEvent } from '../realtime/inbox-realtime.contracts';
import {
  InboxAttachmentIntegrityError,
  InboxAttachmentStorage,
} from './inbox-attachment.storage';
import {
  INBOX_ATTACHMENT_CONFIG,
  type InboxAttachmentConfig,
} from './inbox-attachment.config';
import {
  validateInboxAttachmentUpload,
  type InboxUploadFile,
} from './inbox-attachment.validation';
import type { InboxAttachmentResource } from './inbox-attachments.resource';
import { toResource } from './inbox-attachments.resource';

export interface InboxAttachmentDownload {
  attachment: InboxAttachmentResource;
  bytes: Buffer;
}

/**
 * INBOX-04 private attachment application service.
 *
 * Upload:
 * 1. resolve the conversation through INBOX-02's server-side visibility
 *    predicate (cross-tenant / out-of-scope ids are the same 404);
 * 2. validate MIME, extension, signature, filename and size;
 * 3. generate the object key from the server context only, write the bytes to
 *    the private per-tenant directory, then persist metadata in the tenant
 *    database; if the insert fails the just-written object is removed.
 * Download:
 * 1. load metadata from the tenant database of the server-resolved context
 *    (a foreign id simply does not exist there);
 * 2. require the attachment's conversation to be visible to the acting
 *    user/scope;
 * 3. re-verify stored size and SHA-256 before serving bytes;
 * 4. serve with `nosniff`, a private no-store cache policy and an attachment
 *    disposition — never through a public/static URL.
 */
@Injectable()
export class InboxAttachmentsService {
  private readonly logger = new Logger(InboxAttachmentsService.name);

  constructor(
    private readonly tenantDb: TenantCrmDatabase,
    private readonly storage: InboxAttachmentStorage,
    @Inject(INBOX_ATTACHMENT_CONFIG)
    private readonly config: InboxAttachmentConfig,
    private readonly audit: InboxAuditWriter,
    @Optional()
    private readonly realtime?: InboxRealtimeHub,
  ) {}

  async list(
    context: TenantContext,
    conversationId: string,
  ): Promise<InboxAttachmentResource[]> {
    return this.tenantDb.withTenant(context, async (db) => {
      const conversation = await loadVisibleConversation(
        db,
        context,
        conversationId,
      );
      const rows = await db
        .select()
        .from(inboxAttachments)
        .where(eq(inboxAttachments.conversationId, conversation.id))
        .orderBy(inboxAttachments.createdAt, inboxAttachments.id);
      return rows.map(toResource);
    });
  }

  async create(
    context: TenantContext,
    conversationId: string,
    upload: InboxUploadFile | undefined,
  ): Promise<InboxAttachmentResource> {
    const resource = await this.tenantDb.withTenant(context, async (db) => {
      // Authorization precedes validation and any filesystem write.
      const conversation = await loadVisibleConversation(
        db,
        context,
        conversationId,
      );
      const validated = validateInboxAttachmentUpload(upload, this.config);
      const objectKey = this.storage.createObjectKey(
        context,
        validated.extension,
      );
      await this.storage.write(context, objectKey, validated.bytes);
      try {
        const inserted = await db
          .insert(inboxAttachments)
          .values({
            conversationId: conversation.id,
            objectKey,
            originalFilename: validated.originalFilename,
            contentType: validated.contentType,
            byteSize: validated.byteSize,
            sha256: validated.sha256,
            uploadedByActorId: context.actorId,
          })
          .returning();
        return toResource(inserted[0]);
      } catch (error) {
        // Metadata is the authorization source: an object without a row must
        // never remain readable (or orphaned) after a persistence failure.
        await this.storage.remove(context, objectKey).catch(() => {
          this.logger.error(
            'Attachment cleanup after failed metadata insert did not complete.',
          );
        });
        throw error;
      }
    });
    await this.audit.success(
      context,
      'inbox.attachment.created',
      'attachment',
      resource.id,
    );
    await this.realtime?.publish(
      createInboxRealtimeEvent(
        'inbox.attachment.created',
        resource.conversationId,
        { attachmentId: resource.id },
      ),
    );
    return resource;
  }

  async download(
    context: TenantContext,
    attachmentId: string,
  ): Promise<InboxAttachmentDownload> {
    return this.tenantDb.withTenant(context, async (db) => {
      const rows = await db
        .select()
        .from(inboxAttachments)
        .where(eq(inboxAttachments.id, attachmentId))
        .limit(1);
      if (!rows.length) {
        throw notFoundProblem('inbox_attachment_not_found');
      }
      const attachment = rows[0];
      // Authorization is the conversation, never the attachment id alone.
      await loadVisibleConversation(db, context, attachment.conversationId);

      let bytes: Buffer;
      try {
        bytes = await this.storage.read(context, attachment.objectKey, {
          byteSize: attachment.byteSize,
          sha256: attachment.sha256,
        });
      } catch (error) {
        if (
          error instanceof InboxAttachmentIntegrityError ||
          (error as NodeJS.ErrnoException).code === 'ENOENT'
        ) {
          this.logger.error(
            'Attachment object unavailable or corrupt; details withheld.',
          );
          throw notFoundProblem('inbox_attachment_not_found');
        }
        throw error;
      }
      return { attachment: toResource(attachment), bytes };
    });
  }
}
