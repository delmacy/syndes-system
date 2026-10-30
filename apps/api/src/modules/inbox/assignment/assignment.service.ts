import { Injectable, Optional } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import {
  forbiddenProblem,
  validationProblem,
} from '../../core-crm/crm-problem-details';
import { TenantCrmDatabase } from '../../core-crm/tenant-crm.database';
import { InboxAuditWriter } from '../inbox-audit';
import type { InboxAssignmentUpdateInput } from '../inbox-dtos';
import { inboxConversations } from '../inbox.schema';
import { InboxMembershipPort } from '../inbox-membership.port';
import { resolveMemberAssignment } from '../inbox-scope';
import { loadVisibleConversation } from '../conversations/conversations.service';
import { createInboxRealtimeEvent } from '../realtime/inbox-realtime.contracts';
import { InboxRealtimeHub } from '../realtime/inbox-realtime.hub';

export interface InboxAssignmentResult {
  success: true;
  conversationId: string;
  assigneeActorId: string | null;
  updatedAt: string;
}

/**
 * INBOX-02 conversation assignment.
 *
 * Rules (PRD-002 / INBOX-02):
 * - `assigneeActorId: null` releases the conversation to the shared queue and
 *   is always allowed for a session that can see the conversation;
 * - a `tenant_member` may only assume the conversation itself or release it
 *   (`resolveMemberAssignment`), so an attendant cannot push work onto a peer;
 * - a `tenant_admin` may assign any ACTIVE membership of the same tenant. The
 *   membership is re-read from the Control Plane through the server-resolved
 *   `TenantContext`; a revoked, foreign or unknown actor is refused with the
 *   same validation problem so existence never leaks.
 *
 * Every attempt is audited: success with the conversation resource id, and a
 * denied attempt with the same conversation id (the id is already authorized
 * for the caller at this point, so recording it reveals nothing new).
 */
@Injectable()
export class AssignmentService {
  constructor(
    private readonly tenantDb: TenantCrmDatabase,
    private readonly membershipPort: InboxMembershipPort,
    private readonly audit: InboxAuditWriter,
    @Optional() private readonly realtime?: InboxRealtimeHub,
  ) {}

  async update(
    context: TenantContext,
    conversationId: string,
    input: InboxAssignmentUpdateInput,
  ): Promise<InboxAssignmentResult> {
    const conversation = await this.tenantDb.withTenant(context, (db) =>
      loadVisibleConversation(db, context, conversationId),
    );

    const targetActorId = input.assigneeActorId;
    if (targetActorId !== null) {
      const resolved = resolveMemberAssignment(context, targetActorId);
      if (!resolved.allowed) {
        await this.audit.denied(
          context,
          'inbox.conversation.assigned',
          'conversation',
          conversation.id,
        );
        throw forbiddenProblem(
          'Only tenant administration may assign another member.',
        );
      }

      const member = await this.membershipPort.findActiveMember(
        context,
        targetActorId,
      );
      if (!member) {
        await this.audit.denied(
          context,
          'inbox.conversation.assigned',
          'conversation',
          conversation.id,
        );
        throw validationProblem([
          { field: 'assigneeActorId', rule: 'not_active_member' },
        ]);
      }
    }

    const updated = await this.tenantDb.withTenant(context, (db) =>
      db
        .update(inboxConversations)
        .set({ assigneeActorId: targetActorId, updatedAt: new Date() })
        .where(eq(inboxConversations.id, conversation.id))
        .returning(),
    );
    const row = updated[0];

    await this.audit.success(
      context,
      'inbox.conversation.assigned',
      'conversation',
      conversation.id,
    );

    await this.realtime?.publish(
      createInboxRealtimeEvent('inbox.conversation.assigned', conversation.id, {
        assigneeActorId: targetActorId,
      }),
    );

    return {
      success: true,
      conversationId: conversation.id,
      assigneeActorId: row?.assigneeActorId ?? targetActorId,
      updatedAt: (row?.updatedAt ?? new Date()).toISOString(),
    };
  }
}
