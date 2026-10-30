import { Injectable, Optional } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import { TenantCrmDatabase } from '../../core-crm/tenant-crm.database';
import { InboxAuditWriter } from '../inbox-audit';
import type { InboxStatusUpdateInput } from '../inbox-dtos';
import { inboxConversations } from '../inbox.schema';
import { loadVisibleConversation } from '../conversations/conversations.service';
import { createInboxRealtimeEvent } from '../realtime/inbox-realtime.contracts';
import { InboxRealtimeHub } from '../realtime/inbox-realtime.hub';

export interface InboxStatusResult {
  success: true;
  conversationId: string;
  status: InboxStatusUpdateInput['status'];
  updatedAt: string;
}

/**
 * INBOX-02 conversation status.
 *
 * The frozen contract allows exactly `open`, `pending` and `resolved` (the DTO
 * rejects anything else before this service runs, and the tenant database
 * check constraint is the last line of defence). The actor must be able to see
 * the conversation, which enforces `customer_scope` for state changes too; a
 * hidden or foreign id is the same not-found. Status changes bump
 * `updated_at` so the shared queue reflects the latest activity.
 *
 * A resolved conversation is reopened by the idempotent inbound channel path
 * (INBOX-03), not by an implicit side effect here.
 */
@Injectable()
export class StatusService {
  constructor(
    private readonly tenantDb: TenantCrmDatabase,
    private readonly audit: InboxAuditWriter,
    @Optional() private readonly realtime?: InboxRealtimeHub,
  ) {}

  async update(
    context: TenantContext,
    conversationId: string,
    input: InboxStatusUpdateInput,
  ): Promise<InboxStatusResult> {
    const conversation = await this.tenantDb.withTenant(context, (db) =>
      loadVisibleConversation(db, context, conversationId),
    );

    const updated = await this.tenantDb.withTenant(context, (db) =>
      db
        .update(inboxConversations)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(inboxConversations.id, conversation.id))
        .returning(),
    );
    const row = updated[0];

    await this.audit.success(
      context,
      'inbox.conversation.status.changed',
      'conversation',
      conversation.id,
    );

    await this.realtime?.publish(
      createInboxRealtimeEvent(
        'inbox.conversation.status.changed',
        conversation.id,
        { status: input.status },
      ),
    );

    return {
      success: true,
      conversationId: conversation.id,
      status: (row?.status as InboxStatusResult['status']) ?? input.status,
      updatedAt: (row?.updatedAt ?? new Date()).toISOString(),
    };
  }
}
