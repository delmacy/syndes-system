import { Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import { notFoundProblem } from '../../core-crm/crm-problem-details';
import { crmChannelIdentities } from '../../core-crm/channel-identities/channel-identities.schema';
import { TenantCrmDatabase } from '../../core-crm/tenant-crm.database';
import type { TenantCrmTx } from '../../core-crm/timeline/timeline-recorder';
import { InboxAuditWriter } from '../inbox-audit';
import { inboxConversations, inboxMessages } from '../inbox.schema';
import type { ChannelFailureKind, ChannelPort } from './inbox-channel.port';

/**
 * INBOX-03 outbound delivery.
 *
 * Only public messages are ever dispatched: the service selects
 * `inbox_messages` exclusively (private notes live in `inbox_private_notes`
 * and therefore cannot cross this port), requires `direction = 'outbound'`
 * and takes the body from the persisted row, never from a request.
 *
 * Delivery state is persisted on the message: `pending` -> `dispatched`
 * with the adapter's external id, or `failed`. A failed delivery is never
 * reported as success; `retry` performs a new attempt only for a failed
 * message, and an already dispatched message is returned idempotently
 * without calling the adapter again.
 *
 * The recipient comes from the CRM ChannelIdentity of the conversation's
 * Person in the same tenant database (server-side lookup only). The
 * `TenantContext` is the sole tenant selector; adapter requests carry no
 * tenant or database information.
 *
 * The adapter is passed explicitly by the trusted caller (worker, demo or
 * test), so there is no global adapter registry and a demo fake is never
 * silently installed as a production provider. The advisory transaction
 * lock prevents a concurrent retry from double-sending. The MVP fake is
 * in-process and network-free; a real provider adapter (PRD-003) must move
 * the provider call to a claimed delivery worker instead of holding the
 * tenant transaction.
 */
@Injectable()
export class InboxOutboundService {
  constructor(
    private readonly tenantDb: TenantCrmDatabase,
    private readonly audit: InboxAuditWriter,
  ) {}

  /** Idempotent attempt for a pending or failed public message. */
  async dispatch(
    context: TenantContext,
    messageId: string,
    port: ChannelPort,
  ): Promise<{
    messageId: string;
    deliveryStatus: 'dispatched' | 'failed';
    externalId?: string;
    failureReason?: ChannelFailureKind;
  }> {
    const result = await this.attempt(context, messageId, port, false);
    await this.auditOutcome(context, result);
    return result;
  }

  /** New attempt restricted to a previously failed public message. */
  async retry(
    context: TenantContext,
    messageId: string,
    port: ChannelPort,
  ): Promise<{
    messageId: string;
    deliveryStatus: 'dispatched' | 'failed';
    externalId?: string;
    failureReason?: ChannelFailureKind;
  }> {
    const result = await this.attempt(context, messageId, port, true);
    await this.auditOutcome(context, result);
    return result;
  }

  private async attempt(
    context: TenantContext,
    messageId: string,
    port: ChannelPort,
    retryOnly: boolean,
  ): Promise<{
    messageId: string;
    deliveryStatus: 'dispatched' | 'failed';
    externalId?: string;
    failureReason?: ChannelFailureKind;
  }> {
    return this.tenantDb.withTenant(context, async (db) =>
      db.transaction(async (tx) => {
        await tx.execute(sql`
          SELECT pg_advisory_xact_lock(
            hashtext('inbox:outbound'),
            hashtext(${messageId})
          )
        `);

        const rows = await tx
          .select({
            message: inboxMessages,
            conversation: inboxConversations,
          })
          .from(inboxMessages)
          .innerJoin(
            inboxConversations,
            eq(inboxConversations.id, inboxMessages.conversationId),
          )
          .where(eq(inboxMessages.id, messageId))
          .limit(1);
        if (!rows.length) throw notFoundProblem('inbox_message_not_found');

        const { message, conversation } = rows[0];
        if (message.direction !== 'outbound') {
          throw notFoundProblem('inbox_message_not_public');
        }

        if (message.deliveryStatus === 'dispatched') {
          if (retryOnly) {
            throw notFoundProblem('inbox_message_not_retryable');
          }
          return {
            messageId,
            deliveryStatus: 'dispatched',
            externalId: message.externalId ?? undefined,
          };
        }
        if (retryOnly && message.deliveryStatus !== 'failed') {
          throw notFoundProblem('inbox_message_not_retryable');
        }

        const recipient = await this.resolveRecipient(tx, conversation);
        if (recipient.deliveryStatus === 'failed') {
          await this.markFailed(tx, messageId);
          return {
            messageId,
            deliveryStatus: 'failed',
            failureReason: recipient.failureReason,
          };
        }

        const outcome = await port.dispatchOutbound({
          messageId,
          recipientExternalId: recipient.externalId!,
          body: message.body,
        });
        if (outcome.deliveryStatus === 'dispatched') {
          await tx
            .update(inboxMessages)
            .set({
              deliveryStatus: 'dispatched',
              externalId: outcome.externalId,
            })
            .where(eq(inboxMessages.id, messageId))
            .returning();
          return {
            messageId,
            deliveryStatus: 'dispatched',
            externalId: outcome.externalId,
          };
        }

        await this.markFailed(tx, messageId);
        return {
          messageId,
          deliveryStatus: 'failed',
          failureReason: outcome.failureReason,
        };
      }),
    );
  }

  private async resolveRecipient(
    tx: TenantCrmTx,
    conversation: typeof inboxConversations.$inferSelect,
  ): Promise<{
    deliveryStatus: 'resolved' | 'failed';
    externalId?: string;
    failureReason?: ChannelFailureKind;
  }> {
    if (
      conversation.channel !== 'whatsapp' &&
      conversation.channel !== 'email'
    ) {
      return {
        deliveryStatus: 'failed',
        failureReason: 'channel_unavailable' as ChannelFailureKind,
      };
    }
    if (!conversation.personId) {
      return {
        deliveryStatus: 'failed',
        failureReason: 'recipient_unmapped' as ChannelFailureKind,
      };
    }
    const channel = conversation.channel;
    const identities = await tx
      .select({ externalId: crmChannelIdentities.externalId })
      .from(crmChannelIdentities)
      .where(
        and(
          eq(crmChannelIdentities.personId, conversation.personId),
          eq(crmChannelIdentities.channel, channel),
        ),
      )
      .orderBy(
        asc(crmChannelIdentities.createdAt),
        asc(crmChannelIdentities.id),
      )
      .limit(1);
    const externalId = identities[0]?.externalId;
    return externalId
      ? { deliveryStatus: 'resolved', externalId }
      : {
          deliveryStatus: 'failed',
          failureReason: 'recipient_unmapped' as ChannelFailureKind,
        };
  }

  private async markFailed(tx: TenantCrmTx, messageId: string): Promise<void> {
    await tx
      .update(inboxMessages)
      .set({ deliveryStatus: 'failed' })
      .where(eq(inboxMessages.id, messageId))
      .returning();
  }

  private async auditOutcome(
    context: TenantContext,
    result: {
      messageId: string;
      deliveryStatus: 'dispatched' | 'failed';
      externalId?: string;
      failureReason?: ChannelFailureKind;
    },
  ): Promise<void> {
    if (result.deliveryStatus === 'dispatched') {
      await this.audit.success(
        context,
        'inbox.message.dispatched',
        'message',
        result.messageId,
      );
      return;
    }
    await this.audit.failure(
      context,
      'inbox.message.delivery_failed',
      'message',
      result.messageId,
    );
  }
}
