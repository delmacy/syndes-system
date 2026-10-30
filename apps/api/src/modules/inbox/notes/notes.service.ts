import { Injectable, Optional } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import { TenantCrmDatabase } from '../../core-crm/tenant-crm.database';
import { InboxAuditWriter } from '../inbox-audit';
import type { InboxNoteCreateInput } from '../inbox-dtos';
import { inboxConversations, inboxPrivateNotes } from '../inbox.schema';
import { loadVisibleConversation } from '../conversations/conversations.service';
import { createInboxRealtimeEvent } from '../realtime/inbox-realtime.contracts';
import { InboxRealtimeHub } from '../realtime/inbox-realtime.hub';

export interface InboxNoteResult {
  success: true;
  noteId: string;
  conversationId: string;
  createdAt: string;
}

/**
 * INBOX-02 private notes.
 *
 * A note is intentionally a different resource from a message: it is stored
 * in `inbox_private_notes`, never in `inbox_messages`, and this service does
 * not depend on the outbound channel port at all. No code path (including a
 * retry) can therefore send a note to an external provider.
 */
@Injectable()
export class NotesService {
  constructor(
    private readonly tenantDb: TenantCrmDatabase,
    private readonly audit: InboxAuditWriter,
    @Optional() private readonly realtime?: InboxRealtimeHub,
  ) {}

  async create(
    context: TenantContext,
    conversationId: string,
    input: InboxNoteCreateInput,
  ): Promise<InboxNoteResult> {
    const note = await this.tenantDb.withTenant(context, async (db) => {
      const conversation = await loadVisibleConversation(
        db,
        context,
        conversationId,
      );
      const inserted = await db
        .insert(inboxPrivateNotes)
        .values({
          conversationId: conversation.id,
          authorActorId: context.actorId,
          body: input.body,
        })
        .returning();
      await db
        .update(inboxConversations)
        .set({ updatedAt: new Date() })
        .where(eq(inboxConversations.id, conversation.id));
      return { row: inserted[0], conversationId: conversation.id };
    });

    await this.audit.success(
      context,
      'inbox.note.created',
      'note',
      note.row.id,
    );

    await this.realtime?.publish(
      createInboxRealtimeEvent('inbox.note.created', note.conversationId, {
        noteId: note.row.id,
      }),
    );

    return {
      success: true,
      noteId: note.row.id,
      conversationId: note.conversationId,
      createdAt: note.row.createdAt.toISOString(),
    };
  }
}
