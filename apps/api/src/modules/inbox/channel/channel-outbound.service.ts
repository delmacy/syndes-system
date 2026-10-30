import { Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import { TenantCrmDatabase } from '../../core-crm/tenant-crm.database';
import { InboxAuditWriter } from '../inbox-audit';
import { inboxMessages } from '../inbox.schema';
import { inboxConversations } from '../inbox.schema';
import { crmChannelIdentities } from '../../core-crm/channel-identities/channel-identities.schema';
import type { InboxChannel } from '../inbox-dtos';
import { ChannelAdapterRegistry } from './channel-adapter-registry';

/**
 * INBOX-03 outbound delivery: the ONLY component that dispatches persisted
 * Inbox messages to channel adapters.
 *
 * Trust and honesty rules:
 * - the adapter is resolved from the conversation's PERSISTED product
 *   channel through the adapter registry; private notes never reach this
 *   port because notes are not messages and this service never reads
 *   `inbox_private_notes`;
 * - an absent provider adapter leaves the message at its honest `pending`
 *   state (never silently claimed as delivered);
 * - failed dispatches are persisted as `failed` with a failure audit row:
 *   failure is never reported as success, and recovery is a later
 *   successful dispatch that persists `dispatched` plus the provider-side
 *   external id;
 * - retry of an already `dispatched` message is a no-op on this port (the
 *   message was already sent; inbound-style dedup belongs to the external
 *   id persisted on the row).
 *
 * Unexpected adapter errors are not swallowed: the message stays at its
 * persisted state and the error propagates to the caller.
 */
@Injectable()
export class ChannelOutboundService {
  constructor(
    private readonly tenantDb: TenantCrmDatabase,
    private readonly adapterRegistry: ChannelAdapterRegistry,
    private readonly audit: InboxAuditWriter,
  ) {}

  /**
   * Delivers one persisted outbound message (fresh reply or failed retry)
   * through the adapter for the conversation channel. Returns the message
   * row as persisted after the attempt — unchanged when no provider is
   * bound to the channel or the message was already dispatched.
   */
  async deliverPublicReply(
    context: TenantContext,
    channel: InboxChannel,
    message: typeof inboxMessages.$inferSelect,
  ): Promise<typeof inboxMessages.$inferSelect> {
    if (message.deliveryStatus === 'dispatched') return message;
    const adapter = this.adapterRegistry.adapterFor(channel);
    if (!adapter) return message;

    const recipientExternalId = await this.resolveRecipient(
      context,
      message.conversationId,
      channel,
    );
    if (!recipientExternalId) return this.persistFailure(context, message);

    const outcome = await adapter.dispatchOutbound({
      accountId: context.tenantId,
      accountDatabaseName: context.databaseName,
      conversationId: message.conversationId,
      messageId: message.id,
      recipientExternalId,
      body: message.body,
    });

    if (outcome.deliveryStatus === 'dispatched') {
      return this.persistDispatched(context, message, outcome.externalId);
    }
    return this.persistFailure(context, message);
  }

  private async resolveRecipient(
    context: TenantContext,
    conversationId: string,
    channel: InboxChannel,
  ): Promise<string | null> {
    if (channel !== 'whatsapp' && channel !== 'email') return null;
    return this.tenantDb.withTenant(context, async (db) => {
      const rows = await db
        .select({ externalId: crmChannelIdentities.externalId })
        .from(inboxConversations)
        .innerJoin(
          crmChannelIdentities,
          and(
            eq(crmChannelIdentities.personId, inboxConversations.personId),
            eq(crmChannelIdentities.channel, channel),
          ),
        )
        .where(eq(inboxConversations.id, conversationId))
        .orderBy(
          asc(crmChannelIdentities.createdAt),
          asc(crmChannelIdentities.id),
        )
        .limit(1);
      return rows[0]?.externalId ?? null;
    });
  }

  private async persistDispatched(
    context: TenantContext,
    message: typeof inboxMessages.$inferSelect,
    externalId: string,
  ): Promise<typeof inboxMessages.$inferSelect> {
    // Idempotency on the persisted row: the provider-side external id is
    // stored so retries/stays traceable and unique per the (conversation,
    // external_id) index; direction/conversation stay fixed so a dispatch
    // can never land on another conversation or tenant database.
    const updated = await this.tenantDb.withTenant(context, (db) =>
      db
        .update(inboxMessages)
        .set({ deliveryStatus: 'dispatched', externalId })
        .where(
          and(
            eq(inboxMessages.id, message.id),
            eq(inboxMessages.conversationId, message.conversationId),
            eq(inboxMessages.direction, 'outbound'),
          ),
        )
        .returning(),
    );
    const row = updated[0] ?? message;
    await this.audit.channel(
      context.tenantId,
      'inbox.channel.outbound.dispatched',
      'success',
      message.id,
      context.actorId,
    );
    return row;
  }

  private async persistFailure(
    context: TenantContext,
    message: typeof inboxMessages.$inferSelect,
  ): Promise<typeof inboxMessages.$inferSelect> {
    const updated = await this.tenantDb.withTenant(context, (db) =>
      db
        .update(inboxMessages)
        .set({ deliveryStatus: 'failed' })
        .where(
          and(
            eq(inboxMessages.id, message.id),
            eq(inboxMessages.conversationId, message.conversationId),
            eq(inboxMessages.direction, 'outbound'),
          ),
        )
        .returning(),
    );
    const row = updated[0] ?? message;
    await this.audit.channel(
      context.tenantId,
      'inbox.channel.outbound.failed',
      'failure',
      message.id,
      context.actorId,
    );
    return row;
  }
}
