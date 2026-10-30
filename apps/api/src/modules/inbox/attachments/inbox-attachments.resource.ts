import type { InboxAttachment } from '../inbox.schema';

/**
 * INBOX-04 attachment resource. The storage object key is never exposed:
 * clients address attachments through this API only, and every download is
 * authorized by the visible conversation on each request.
 */
export interface InboxAttachmentResource {
  id: string;
  conversationId: string;
  filename: string;
  contentType: string;
  byteSize: number;
  createdAt: string;
  downloadUrl: string;
}

export function toResource(row: InboxAttachment): InboxAttachmentResource {
  return {
    id: row.id,
    conversationId: row.conversationId,
    filename: row.originalFilename,
    contentType: row.contentType,
    byteSize: row.byteSize,
    createdAt: row.createdAt.toISOString(),
    downloadUrl: `/api/v1/inbox/attachments/${row.id}`,
  };
}
