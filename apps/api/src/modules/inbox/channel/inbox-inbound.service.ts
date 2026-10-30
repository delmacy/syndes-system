import { Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import { notFoundProblem } from '../../core-crm/crm-problem-details';
import { crmChannelIdentities } from '../../core-crm/channel-identities/channel-identities.schema';
import { TenantCrmDatabase } from '../../core-crm/tenant-crm.database';
import type { TenantCrmTx } from '../../core-crm/timeline/timeline-recorder';
import { InboxAuditWriter } from '../inbox-audit';
import { inboxConversations, inboxMessages } from '../inbox.schema';
import {
  parseInboxProductChannel,
  parseChannelInboundEvent,
} from './inbox-channel.port';
import type { InboxProductChannel } from './inbox-channel.port';

/**
 * INBOX-03 inbound ingress.
 *
 * The caller passes the trusted `TenantContext` it already resolved
 * server-side plus the product channel from its server-side binding. The
 * event payload is parsed with an allowlist and can never choose tenant,
 * database or channel.
 *
 * Resolution is entirely tenant-local:
 * 1. `crm_channel_identities` maps (channel, external sender id) to a CRM
 *    Person inside the tenant database;
 * 2. the conversation is the Person's conversation for that channel (created
 *    on first contact);
 * 3. `(channel, externalMessageId)` is the idempotency boundary — retries
 *    return the already persisted message with `duplicate: true` and never
 *    insert twice.
 *
 * An advisory transaction lock per (tenant, channel, sender) serializes
 * concurrent deliveries, so a first-contact race cannot create two
 * conversations and a duplicate cannot slip between check and insert.
 * Out-of-order events keep their original `occurredAt` as `created_at`, so
 * history ordering stays deterministic while the queue bumps `updated_at`.
 */
@Injectable()
export class InboxInboundService {
  constructor(
    private readonly tenantDb: TenantCrmDatabase,
    private readonly audit: InboxAuditWriter,
  ) {}

  async ingest(
    context: TenantContext,
    channelInput: unknown,
    payload: unknown,
  ): Promise<{
    tenantId: string;
    conversationId: string;
    messageId: string;
    duplicate: boolean;
    deliveryStatus: 'dispatched';
  }> {
    // Both validations happen before any tenant database work: a payload
    // carrying tenant/database fields is rejected without touching a DB.
    const channel = parseInboxProductChannel(channelInput);
    const event = parseChannelInboundEvent(payload);

    const result = await this.tenantDb.withTenant(context, async (db) =>
      db.transaction(async (tx) => {
        await tx.execute(sql`
          SELECT pg_advisory_xact_lock(
            hashtext('inbox:inbound'),
            hashtext(${`${channel}:${event.senderExternalId}`})
          )
        `);

        const identities = await tx
          .select({ personId: crmChannelIdentities.personId })
          .from(crmChannelIdentities)
          .where(
            and(
              eq(crmChannelIdentities.channel, channel),
              eq(crmChannelIdentities.externalId, event.senderExternalId),
            ),
          )
          .orderBy(
            asc(crmChannelIdentities.createdAt),
            asc(crmChannelIdentities.id),
          )
          .limit(1);
        if (!identities.length) {
          // No implicit Person creation: CRM stays the canonical source of
          // people and channel identities. Details never leak the lookup.
          throw notFoundProblem('inbox_channel_identity_not_found');
        }
        const personId = identities[0].personId;

        const duplicate = await this.findByExternalId(
          tx,
          channel,
          event.externalMessageId,
        );
        if (duplicate) {
          return {
            tenantId: context.tenantId,
            conversationId: duplicate.conversationId,
            messageId: duplicate.message.id,
            duplicate: true,
            deliveryStatus: 'dispatched',
          };
        }

        const existingConversations = await tx
          .select()
          .from(inboxConversations)
          .where(
            and(
              eq(inboxConversations.personId, personId),
              eq(inboxConversations.channel, channel),
            ),
          )
          .orderBy(
            sql`${inboxConversations.createdAt} DESC, ${inboxConversations.id} DESC`,
          )
          .limit(1);
        const conversation =
          existingConversations[0] ??
          (
            await tx
              .insert(inboxConversations)
              .values({ personId, channel })
              .returning()
          )[0];

        const createdAt = event.occurredAt
          ? new Date(event.occurredAt)
          : new Date();
        const inserted = await tx
          .insert(inboxMessages)
          .values({
            conversationId: conversation.id,
            direction: 'inbound',
            body: event.body,
            authorExternalId: event.senderExternalId,
            deliveryStatus: 'dispatched',
            externalId: event.externalMessageId,
            createdAt,
          })
          .onConflictDoNothing()
          .returning();

        if (!inserted.length) {
          // The transaction lock above should make this unreachable, but a
          // losing duplicate is still answered with the persisted message
          // instead of an error or a second row.
          const raced = await this.findByExternalId(
            tx,
            channel,
            event.externalMessageId,
          );
          if (!raced) {
            throw new Error('Inbox inbound duplicate could not be resolved.');
          }
          return {
            tenantId: context.tenantId,
            conversationId: raced.conversationId,
            messageId: raced.message.id,
            duplicate: true,
            deliveryStatus: 'dispatched',
          };
        }

        await tx
          .update(inboxConversations)
          .set({ updatedAt: new Date() })
          .where(eq(inboxConversations.id, conversation.id))
          .returning();

        return {
          tenantId: context.tenantId,
          conversationId: conversation.id,
          messageId: inserted[0].id,
          duplicate: false,
          deliveryStatus: 'dispatched',
        };
      }),
    );

    await this.audit.success(
      context,
      'inbox.message.received',
      'message',
      result.messageId,
    );

    return {
      tenantId: result.tenantId,
      conversationId: result.conversationId,
      messageId: result.messageId,
      duplicate: result.duplicate,
      deliveryStatus: result.deliveryStatus as 'dispatched',
    };
  }

  private async findByExternalId(
    tx: TenantCrmTx,
    channel: InboxProductChannel,
    externalMessageId: string,
  ): Promise<{
    conversationId: string;
    message: typeof inboxMessages.$inferSelect;
  } | null> {
    const rows = await tx
      .select({
        message: inboxMessages,
        conversationId: inboxConversations.id,
      })
      .from(inboxMessages)
      .innerJoin(
        inboxConversations,
        eq(inboxConversations.id, inboxMessages.conversationId),
      )
      .where(
        and(
          eq(inboxConversations.channel, channel),
          eq(inboxMessages.externalId, externalMessageId),
        ),
      )
      .limit(1);
    return rows.length ? rows[0] : null;
  }
}
