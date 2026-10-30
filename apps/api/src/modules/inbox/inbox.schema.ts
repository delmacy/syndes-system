import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { crmOrganizations, crmPeople } from '../core-crm/tenant-crm.schema';

/**
 * INBOX-02 Inbox tenant schema (tenant PostgreSQL database only).
 *
 * Definitions mirror the reviewed tenant migration in
 * `apps/api/drizzle/tenant/20261029180000_inbox_core.sql`. There is no
 * tenant_id column by design: every request is routed to exactly one tenant
 * database server-side (TenantContext), so tenant isolation is enforced by
 * database routing, never by client-controlled identifiers. Control Plane
 * actor ids (author/assignee) are stored as plain references without
 * cross-database keys; live membership validation is server-side.
 *
 * Public messages and private notes are distinct resources. Notes never
 * share the outbound channel contract, so no INBOX-03 channel port can ever
 * dispatch internal-only content.
 */

export const inboxConversations = pgTable(
  'inbox_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id').references(() => crmPeople.id, {
      onDelete: 'set null',
    }),
    organizationId: uuid('organization_id').references(
      () => crmOrganizations.id,
      { onDelete: 'set null' },
    ),
    status: text('status').notNull().default('open'),
    assigneeActorId: uuid('assignee_actor_id'),
    channel: text('channel').notNull().default('unknown'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('inbox_conversations_person_idx').on(table.personId),
    index('inbox_conversations_organization_idx').on(table.organizationId),
    index('inbox_conversations_assignee_actor_idx').on(table.assigneeActorId),
    index('inbox_conversations_status_idx').on(
      table.status,
      table.createdAt,
      table.id,
    ),
    check(
      'inbox_conversations_status_check',
      sql`${table.status} IN ('open', 'pending', 'resolved')`,
    ),
    check(
      'inbox_conversations_channel_check',
      sql`${table.channel} IN ('whatsapp', 'email', 'unknown')`,
    ),
  ],
);

/**
 * Author coherence is enforced by the database check constraint: an
 * outbound message always carries the Control Plane actor reference while
 * an inbound message always carries the external channel identity.
 */
export const inboxMessages = pgTable(
  'inbox_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => inboxConversations.id, { onDelete: 'cascade' }),
    direction: text('direction').notNull(),
    body: text('body').notNull(),
    authorActorId: uuid('author_actor_id'),
    authorExternalId: text('author_external_id'),
    deliveryStatus: text('delivery_status').notNull().default('pending'),
    externalId: text('external_id'),
    sourceChannel: text('source_channel'),
    idempotencyKey: text('idempotency_key'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('inbox_messages_conversation_order_idx').on(
      table.conversationId,
      table.createdAt,
      table.id,
    ),
    uniqueIndex('inbox_messages_conversation_external_unique')
      .on(table.conversationId, table.externalId)
      .where(sql`${table.externalId} IS NOT NULL`),
    // INBOX-03 durable idempotency: the external message id is unique per
    // channel INSIDE the tenant database, independently of which
    // conversation a racing delivery happened to create. A replay can
    // therefore never insert a second message in another conversation.
    uniqueIndex('inbox_messages_channel_external_unique')
      .on(table.sourceChannel, table.externalId)
      .where(
        sql`${table.externalId} IS NOT NULL AND ${table.sourceChannel} IS NOT NULL`,
      ),
    uniqueIndex('inbox_messages_conversation_idempotency_unique')
      .on(table.conversationId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} IS NOT NULL`),
    check(
      'inbox_messages_direction_check',
      sql`${table.direction} IN ('inbound', 'outbound')`,
    ),
    check(
      'inbox_messages_body_check',
      sql`${table.body} <> '' AND char_length(${table.body}) <= 10000`,
    ),
    check(
      'inbox_messages_delivery_status_check',
      sql`${table.deliveryStatus} IN ('pending', 'dispatched', 'failed')`,
    ),
    check(
      'inbox_messages_author_actor_id_check',
      sql`(${table.direction} = 'outbound' AND ${table.authorActorId} IS NOT NULL AND ${table.authorExternalId} IS NULL) OR (${table.direction} = 'inbound' AND ${table.authorActorId} IS NULL AND ${table.authorExternalId} IS NOT NULL)`,
    ),
    check(
      'inbox_messages_author_external_id_check',
      sql`${table.authorExternalId} IS NULL OR (${table.authorExternalId} <> '' AND char_length(${table.authorExternalId}) <= 200)`,
    ),
    check(
      'inbox_messages_external_id_check',
      sql`${table.externalId} IS NULL OR (${table.externalId} <> '' AND char_length(${table.externalId}) <= 200)`,
    ),
    check(
      'inbox_messages_source_channel_check',
      sql`${table.sourceChannel} IS NULL OR ${table.sourceChannel} IN ('whatsapp', 'email')`,
    ),
    check(
      'inbox_messages_idempotency_key_check',
      sql`${table.idempotencyKey} IS NULL OR (${table.idempotencyKey} <> '' AND char_length(${table.idempotencyKey}) <= 200)`,
    ),
  ],
);

/** Private/internal-only attendant notes; intentionally not a message. */
export const inboxPrivateNotes = pgTable(
  'inbox_private_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => inboxConversations.id, { onDelete: 'cascade' }),
    authorActorId: uuid('author_actor_id').notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('inbox_private_notes_conversation_order_idx').on(
      table.conversationId,
      table.createdAt,
      table.id,
    ),
    check(
      'inbox_private_notes_body_check',
      sql`${table.body} <> '' AND char_length(${table.body}) <= 10000`,
    ),
  ],
);

/**
 * INBOX-04 private attachment metadata (tenant database).
 *
 * Bytes never live in PostgreSQL and never in a web-served directory: they
 * are written by `InboxAttachmentStorage` under a private per-tenant
 * directory, and `object_key` is entirely server-generated
 * (`<tenant uuid>/<random uuid>.<canonical extension>`). The client's
 * filename is stored only as display metadata, sanitized, and can never
 * contribute to the storage path. The database additionally enforces the
 * object-key shape and the hard size ceiling, so an out-of-band write cannot
 * turn a row into a traversal or an oversize object. Authorization for every
 * download is derived from the visible conversation, never from possession
 * of the attachment id.
 */
export const inboxAttachments = pgTable(
  'inbox_attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => inboxConversations.id, { onDelete: 'cascade' }),
    objectKey: text('object_key').notNull(),
    originalFilename: text('original_filename').notNull(),
    contentType: text('content_type').notNull(),
    byteSize: integer('byte_size').notNull(),
    sha256: text('sha256').notNull(),
    uploadedByActorId: uuid('uploaded_by_actor_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('inbox_attachments_object_key_unique').on(table.objectKey),
    index('inbox_attachments_conversation_order_idx').on(
      table.conversationId,
      table.createdAt,
      table.id,
    ),
    check(
      'inbox_attachments_object_key_check',
      sql`${table.objectKey} ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.][a-z0-9]{1,10}$'`,
    ),
    check(
      'inbox_attachments_filename_check',
      sql`${table.originalFilename} <> '' AND char_length(${table.originalFilename}) <= 255 AND position('/' in ${table.originalFilename}) = 0 AND position(chr(92) in ${table.originalFilename}) = 0`,
    ),
    check(
      'inbox_attachments_content_type_check',
      sql`${table.contentType} ~ '^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$'`,
    ),
    check(
      'inbox_attachments_byte_size_check',
      sql`${table.byteSize} > 0 AND ${table.byteSize} <= 26214400`,
    ),
    check(
      'inbox_attachments_sha256_check',
      sql`${table.sha256} ~ '^[a-f0-9]{64}$'`,
    ),
  ],
);

export type InboxConversation = typeof inboxConversations.$inferSelect;
export type NewInboxConversation = typeof inboxConversations.$inferInsert;
export type InboxMessage = typeof inboxMessages.$inferSelect;
export type NewInboxMessage = typeof inboxMessages.$inferInsert;
export type InboxPrivateNote = typeof inboxPrivateNotes.$inferSelect;
export type NewInboxPrivateNote = typeof inboxPrivateNotes.$inferInsert;
export type InboxAttachment = typeof inboxAttachments.$inferSelect;
export type NewInboxAttachment = typeof inboxAttachments.$inferInsert;
