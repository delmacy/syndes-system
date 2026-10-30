import { Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import { notFoundProblem } from '../../core-crm/crm-problem-details';
import { TenantCrmDatabase } from '../../core-crm/tenant-crm.database';
import { crmChannelIdentities } from '../../core-crm/channel-identities/channel-identities.schema';
import { InboxAuditWriter } from '../inbox-audit';
import { inboxConversations, inboxMessages } from '../inbox.schema';
import type { InboxChannel } from '../inbox-dtos';
import { InboxChannelRegistry } from './inbox-channel-registry';
import type { ChannelBindingRecord } from './inbox-channel-registry';
import { parseChannelInboundEvent } from './inbox-channel.contracts';
import type { ChannelInboundEvent } from './inbox-channel.contracts';

/**
 * Routing-only tenant key for channel ingestion (INBOX-03).
 *
 * The TenantContext normally carries the acting attendant, but channel
 * deliveries are server/system actions: this reserved actor UUID is only a
 * routing key for the tenant database registry (which consults tenantId and
 * databaseName exclusively). It is NEVER persisted as a message author
 * (inbound rows always carry `authorExternalId`) and NEVER written to the
 * audit trail (channel audit rows are actor-less, tenant-attributed).
 */
export const CHANNEL_ROUTING_ACTOR_ID = '00000000-0000-4000-8000-0000000000cc';

/**
 * INBOX-03 channel ingress: the trusted path from a channel event to an
 * Inbox message inside the tenant database.
 *
 * Server-side trust chain for every delivery:
 * 1. the binding token (never part of the payload) resolves through the
 *    trusted registry to exactly one tenant id, tenant database and product
 *    channel — an unknown token is an unusable delivery;
 * 2. the event body is validated against the frozen contract, and unknown
 *    payload fields are rejected, so the external payload can never carry
 *    tenant/database/selectors at all;
 * 3. persistence happens ONLY in the tenant database resolved in step 1.
 *
 * Idempotency: the external message id is deduplicated per channel binding
 * (== per tenant channel, MVP scope): a duplicate/replayed event returns the
 * already-persisted message, never a second row, and the duplicate is
 * audited as such.
 *
 * Conversation routing:
 * - a sender mapped by CRM `ChannelIdentity` (channel, external id) -> Person
 *   is routed to that person's latest non-resolved conversation (a resolved
 *   conversation is reopened — the spec's idempotent reopen rule);
 * - an unmapped sender is routed via message-author correlation (latest
 *   non-resolved conversation that already has an inbound message from the
 *   same author external id) or, absent that, opens a new UNLINKED
 *   conversation which stays tenant_admin-only until the CRM associates it.
 */
@Injectable()
export class ChannelIngressService {
  constructor(
    private readonly tenantDb: TenantCrmDatabase,
    private readonly registry: InboxChannelRegistry,
    private readonly audit: InboxAuditWriter,
  ) {}

  async ingest(
    bindingToken: string,
    rawEvent: unknown,
  ): Promise<{
    tenantId: string;
    conversationId: string;
    messageId: string;
    duplicate: boolean;
    deliveryStatus: 'dispatched';
  }> {
    const binding = this.registry.resolve(bindingToken);
    if (!binding) {
      throw notFoundProblem(
        'inbox_channel_binding_not_found',
        'Channel delivery has no trusted binding.',
      );
    }
    const event = parseChannelInboundEvent(rawEvent);
    return this.tenantDb.withTenant(routingContextFor(binding), (db) =>
      this.ingestWithinTenant(binding, event, db),
    );
  }

  /**
   * Trusted internal adapter entrypoint. The caller must authenticate the
   * adapter and resolve this binding from the Control Plane; external payloads
   * still cannot provide tenant or database selectors.
   */
  async ingestTrustedBinding(
    binding: ChannelBindingRecord,
    rawEvent: unknown,
  ): Promise<{
    tenantId: string;
    conversationId: string;
    messageId: string;
    duplicate: boolean;
    deliveryStatus: 'dispatched';
  }> {
    const event = parseChannelInboundEvent(rawEvent);
    return this.tenantDb.withTenant(routingContextFor(binding), (db) =>
      this.ingestWithinTenant(binding, event, db),
    );
  }

  private async ingestWithinTenant(
    binding: ChannelBindingRecord,
    event: ChannelInboundEvent,
    db: Parameters<Parameters<TenantCrmDatabase['withTenant']>[1]>[0],
  ): Promise<{
    tenantId: string;
    conversationId: string;
    messageId: string;
    duplicate: boolean;
    deliveryStatus: 'dispatched';
  }> {
    // 1) per-binding idempotency: the external message id is deduplicated
    // per channel binding (== per tenant channel). sourceChannel is part of
    // the dedup key so a replayed external id can never collide across
    // channels/conversations inside the same tenant database.
    const existing = await db
      .select()
      .from(inboxMessages)
      .where(
        and(
          eq(inboxMessages.direction, 'inbound'),
          eq(inboxMessages.sourceChannel, binding.productChannel),
          eq(inboxMessages.externalId, event.externalMessageId),
        ),
      )
      .limit(1);
    if (existing.length) {
      await this.audit.channel(
        binding.tenantId,
        'inbox.channel.message.duplicated',
        'success',
        existing[0].id,
      );
      return {
        tenantId: binding.tenantId,
        conversationId: existing[0].conversationId,
        messageId: existing[0].id,
        duplicate: true,
        deliveryStatus: 'dispatched',
      };
    }

    // 2) identity routing through the canonical CRM ChannelIdentity base.
    const personId = await resolveChannelIdentityPerson(
      db,
      binding.productChannel,
      event.senderExternalId,
    );
    const conversation = await resolveInboundConversation(
      db,
      event.senderExternalId,
      personId,
    );
    let conversationId: string;
    if (conversation) {
      // New inbound message reopens a resolved conversation (frozen rule).
      if (conversation.status === 'resolved') {
        await db
          .update(inboxConversations)
          .set({ status: 'open', updatedAt: new Date() })
          .where(eq(inboxConversations.id, conversation.id));
      }
      conversationId = conversation.id;
    } else {
      const inserted = await db
        .insert(inboxConversations)
        .values({
          ...(personId ? { personId } : {}),
          channel: binding.productChannel,
          status: 'open',
        })
        .returning({ id: inboxConversations.id });
      conversationId = inserted[0].id;
    }

    // 3) persist the message; the externalId on the row IS the persisted
    // idempotency state — future replays hit the dedup select above.
    const messageRows = await db
      .insert(inboxMessages)
      .values({
        conversationId,
        direction: 'inbound',
        body: event.body,
        authorExternalId: event.senderExternalId,
        externalId: event.externalMessageId,
        sourceChannel: binding.productChannel,
        deliveryStatus: 'dispatched',
        ...(event.occurredAt ? { createdAt: new Date(event.occurredAt) } : {}),
      })
      .returning();
    const message = messageRows[0];
    await this.audit.channel(
      binding.tenantId,
      'inbox.channel.message.received',
      'success',
      message.id,
    );
    return {
      tenantId: binding.tenantId,
      conversationId,
      messageId: message.id,
      duplicate: false,
      deliveryStatus: 'dispatched',
    };
  }
}

function routingContextFor(binding: ChannelBindingRecord): TenantContext {
  return {
    actorId: CHANNEL_ROUTING_ACTOR_ID,
    tenantId: binding.tenantId,
    databaseName: binding.databaseName,
    role: 'tenant_admin',
    customerScope: 'both',
  };
}

/** Canonical CRM identity: (channel, external id) -> linked Person id. */
async function resolveChannelIdentityPerson(
  db: Parameters<Parameters<TenantCrmDatabase['withTenant']>[1]>[0],
  channel: InboxChannel,
  senderExternalId: string,
): Promise<string | null> {
  const rows = await db
    .select({ personId: crmChannelIdentities.personId })
    .from(crmChannelIdentities)
    .where(
      and(
        eq(crmChannelIdentities.channel, channel),
        eq(crmChannelIdentities.externalId, senderExternalId),
      ),
    )
    .limit(1);
  return rows[0]?.personId ?? null;
}

type ConversationStateRow = {
  id: string;
  status: string;
};

/**
 * Conversation routing policy (see class doc): person identity first, then
 * author-correlation through already-persisted inbound messages, then a new
 * conversation. Active/unresolved conversations absorb new messages;
 * resolved ones are reopened by the caller.
 */
async function resolveInboundConversation(
  db: Parameters<Parameters<TenantCrmDatabase['withTenant']>[1]>[0],
  senderExternalId: string,
  personId: string | null,
): Promise<ConversationStateRow | undefined> {
  const active = sql`${inboxConversations.status} <> 'resolved'`;
  const rows = await db
    .select({
      id: inboxConversations.id,
      status: inboxConversations.status,
    })
    .from(inboxConversations)
    .where(
      personId
        ? and(eq(inboxConversations.personId, personId), active)
        : and(
            active,
            sql`EXISTS (
              SELECT 1 FROM ${inboxMessages} inbound_author
              WHERE inbound_author.conversation_id = ${inboxConversations.id}
                AND inbound_author.direction = 'inbound'
                AND inbound_author.author_external_id = ${senderExternalId}
            )`,
          ),
    )
    .orderBy(desc(inboxConversations.createdAt), desc(inboxConversations.id))
    .limit(1);
  return rows[0];
}
