import { Injectable, Optional } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import {
  notFoundProblem,
  pgErrorCause,
} from '../../core-crm/crm-problem-details';
import { TenantCrmDatabase } from '../../core-crm/tenant-crm.database';
import type { TenantCrmDb } from '../../core-crm/tenant-crm.database';
import { InboxAuditWriter } from '../inbox-audit';
import type {
  InboxMessageCreateInput,
  InboxMessageListQuery,
} from '../inbox-dtos';
import { inboxConversations, inboxMessages } from '../inbox.schema';
import { ChannelOutboundService } from '../channel/channel-outbound.service';
import { loadVisibleConversation } from '../conversations/conversations.service';
import { createInboxRealtimeEvent } from '../realtime/inbox-realtime.contracts';
import { InboxRealtimeHub } from '../realtime/inbox-realtime.hub';

export type InboxTimelineKind = 'inbound' | 'outgoing' | 'note';

export interface InboxTimelineEntry {
  id: string;
  kind: InboxTimelineKind;
  content: string;
  author: {
    role: 'agent' | 'customer';
    name: string | null;
    actorId: string | null;
  };
  createdAt: string;
  /** Delivery state of a public message; absent for private notes. */
  deliveryStatus?: 'pending' | 'dispatched' | 'failed';
  direction?: 'inbound' | 'outbound' | 'note';
  externalId?: string | null;
}

export interface InboxPublicMessageResult {
  /**
   * True when the reply was persisted and not reported as a failed delivery.
   * `deliveryStatus` remains the source of truth for whether the channel
   * adapter actually confirmed delivery.
   */
  success: boolean;
  messageId: string;
  deliveryStatus: 'pending' | 'dispatched' | 'failed';
  externalId?: string | null;
  createdAt: string;
  error?: string;
}

type TimelineRow = {
  id: string;
  record_type: 'message' | 'note';
  direction: string;
  body: string;
  author_actor_id: string | null;
  delivery_status: string | null;
  external_id: string | null;
  created_at: Date | string;
};

export function toTimelineEntry(row: TimelineRow): InboxTimelineEntry {
  const createdAt =
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : new Date(row.created_at).toISOString();

  if (row.record_type === 'note') {
    return {
      id: row.id,
      kind: 'note',
      content: row.body,
      author: { role: 'agent', name: null, actorId: row.author_actor_id },
      createdAt,
      direction: 'note',
    };
  }

  const inbound = row.direction === 'inbound';
  return {
    id: row.id,
    kind: inbound ? 'inbound' : 'outgoing',
    content: row.body,
    author: {
      role: inbound ? 'customer' : 'agent',
      name: null,
      actorId: inbound ? null : row.author_actor_id,
    },
    createdAt,
    deliveryStatus: (row.delivery_status ?? 'pending') as
      'pending' | 'dispatched' | 'failed',
    direction: inbound ? 'inbound' : 'outbound',
    externalId: row.external_id ?? null,
  };
}

async function findMessageByIdempotencyKey(
  db: TenantCrmDb,
  conversationId: string,
  idempotencyKey: string,
): Promise<typeof inboxMessages.$inferSelect | null> {
  const rows = await db
    .select()
    .from(inboxMessages)
    .where(
      sql`${inboxMessages.conversationId} = ${conversationId}
          AND ${inboxMessages.idempotencyKey} = ${idempotencyKey}
          AND ${inboxMessages.direction} = 'outbound'`,
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * INBOX-02 message history and public replies.
 *
 * History is the durable merge of public messages and private notes, ordered
 * by the permanent `(created_at, id)` pair. The cursor is the previous
 * record id: its stored timestamp is read from the tenant database and the
 * next page is strictly greater than that pair, so equal/very close
 * timestamps (including microsecond `.123456`/`.123457` values) cannot drop
 * or repeat a message. Private notes are read from `inbox_private_notes` and
 * are never inserted into `inbox_messages`.
 *
 * A public reply is persisted first (`pending`) and only then handed to the
 * outbound channel port. The response reports the persisted delivery state:
 * no adapter confirmation means `pending`, a failed attempt means `failed`
 * and `success: false`. `Idempotency-Key` is unique per conversation: a
 * replay returns the original message id, never a duplicate, and a retry of
 * a non-dispatched message performs a new delivery attempt on that same row.
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly tenantDb: TenantCrmDatabase,
    private readonly channelOutbound: ChannelOutboundService,
    private readonly audit: InboxAuditWriter,
    @Optional() private readonly realtime?: InboxRealtimeHub,
  ) {}

  async list(
    context: TenantContext,
    conversationId: string,
    query: InboxMessageListQuery,
  ): Promise<InboxTimelineEntry[]> {
    return this.tenantDb.withTenant(context, async (db) => {
      await loadVisibleConversation(db, context, conversationId);

      let cursorClause = sql``;
      if (query.after) {
        const cursor = await db.execute(sql`
          SELECT cursor."created_at", cursor."id"
            FROM (
              SELECT "id", "created_at"
                FROM "inbox_messages"
               WHERE "conversation_id" = ${conversationId}
              UNION ALL
              SELECT "id", "created_at"
                FROM "inbox_private_notes"
               WHERE "conversation_id" = ${conversationId}
            ) cursor
           WHERE cursor."id" = ${query.after}
           LIMIT 1
        `);
        const cursorRow = cursor.rows[0] as
          { created_at: Date | string; id: string } | undefined;
        if (!cursorRow) {
          throw notFoundProblem('inbox_message_cursor_not_found');
        }
        cursorClause = sql`AND (history."created_at", history."id") > (${cursorRow.created_at}, ${cursorRow.id})`;
      }

      const result = await db.execute(sql`
        SELECT history.*
          FROM (
            SELECT "id", 'message'::text AS "record_type", "direction", "body",
                   "author_actor_id", "delivery_status", "external_id",
                   "created_at"
              FROM "inbox_messages"
             WHERE "conversation_id" = ${conversationId}
            UNION ALL
            SELECT "id", 'note'::text AS "record_type", 'note'::text AS "direction",
                   "body", "author_actor_id", NULL::text AS "delivery_status",
                   NULL::text AS "external_id", "created_at"
              FROM "inbox_private_notes"
             WHERE "conversation_id" = ${conversationId}
          ) history
         WHERE TRUE
         ${cursorClause}
         ORDER BY history."created_at" ASC, history."id" ASC
         LIMIT ${query.limit}
      `);

      return (result.rows as TimelineRow[]).map(toTimelineEntry);
    });
  }

  async create(
    context: TenantContext,
    conversationId: string,
    input: InboxMessageCreateInput,
    idempotencyKey: string,
  ): Promise<InboxPublicMessageResult> {
    const persisted = await this.tenantDb.withTenant(context, async (db) => {
      const conversation = await loadVisibleConversation(
        db,
        context,
        conversationId,
      );

      let message = await findMessageByIdempotencyKey(
        db,
        conversation.id,
        idempotencyKey,
      );
      let created = false;

      if (!message) {
        try {
          const inserted = await db
            .insert(inboxMessages)
            .values({
              conversationId: conversation.id,
              direction: 'outbound',
              body: input.body,
              authorActorId: context.actorId,
              deliveryStatus: 'pending',
              idempotencyKey,
              ...(conversation.channel === 'whatsapp' ||
              conversation.channel === 'email'
                ? { sourceChannel: conversation.channel }
                : {}),
            })
            .returning();
          message = inserted[0];
          created = true;
          await db
            .update(inboxConversations)
            .set({ updatedAt: new Date() })
            .where(eq(inboxConversations.id, conversation.id));
        } catch (error) {
          if (pgErrorCause(error).code !== '23505') throw error;
          // A concurrent replay with the same Idempotency-Key lost the
          // insert race; the persisted row is the idempotent answer.
          message = await findMessageByIdempotencyKey(
            db,
            conversation.id,
            idempotencyKey,
          );
          if (!message) throw error;
        }
      }

      return { conversation, message, created };
    });

    if (persisted.created) {
      await this.audit.success(
        context,
        'inbox.message.created',
        'message',
        persisted.message.id,
      );
    }

    let delivered = persisted.message;
    try {
      delivered = await this.channelOutbound.deliverPublicReply(
        context,
        persisted.conversation.channel,
        persisted.message,
      );
    } catch (error) {
      await this.audit.failure(
        context,
        'inbox.message.delivery_failed',
        'message',
        persisted.message.id,
      );
      throw error;
    }

    if (delivered.deliveryStatus === 'failed') {
      await this.audit.failure(
        context,
        'inbox.message.delivery_failed',
        'message',
        delivered.id,
      );
    }

    await this.realtime?.publish(
      createInboxRealtimeEvent(
        'inbox.message.created',
        persisted.conversation.id,
        { messageId: delivered.id },
      ),
    );

    return {
      success: delivered.deliveryStatus !== 'failed',
      messageId: delivered.id,
      deliveryStatus: delivered.deliveryStatus as
        'pending' | 'dispatched' | 'failed',
      externalId: delivered.externalId ?? null,
      createdAt: delivered.createdAt.toISOString(),
      ...(delivered.deliveryStatus === 'failed'
        ? { error: 'delivery_failed' }
        : {}),
    };
  }
}
