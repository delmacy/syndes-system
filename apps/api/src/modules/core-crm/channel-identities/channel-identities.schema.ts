import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { crmPeople } from '../tenant-crm.schema';

/**
 * CRM-06 channel identities (tenant database only). An external channel
 * identity links to one Person; external display metadata (push name,
 * business name) is stored here, kept strictly separate from the
 * confirmed CRM name, which lives only in `crm_people.full_name` and is
 * never overwritten by channel metadata (CRM-00/AGENTS rule).
 *
 * There is no real channel integration in the MVP: rows are written by
 * the authorized upsert operation that later channel adapters will call.
 */
export const crmChannelIdentities = pgTable(
  'crm_channel_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id')
      .notNull()
      .references(() => crmPeople.id),
    channel: text('channel').notNull(),
    externalId: text('external_id').notNull(),
    externalUsername: text('external_username'),
    pushName: text('push_name'),
    businessName: text('business_name'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('crm_channel_identities_person_idx').on(table.personId),
    uniqueIndex('crm_channel_identities_channel_external_unique').on(
      table.channel,
      table.externalId,
    ),
    check(
      'crm_channel_identities_channel_check',
      sql`${table.channel} IN ('whatsapp')`,
    ),
    check(
      'crm_channel_identities_external_id_check',
      sql`${table.externalId} <> '' AND char_length(${table.externalId}) <= 200`,
    ),
    check(
      'crm_channel_identities_external_username_check',
      sql`${table.externalUsername} IS NULL OR (${table.externalUsername} <> '' AND char_length(${table.externalUsername}) <= 200)`,
    ),
    check(
      'crm_channel_identities_push_name_check',
      sql`${table.pushName} IS NULL OR (${table.pushName} <> '' AND char_length(${table.pushName}) <= 200)`,
    ),
    check(
      'crm_channel_identities_business_name_check',
      sql`${table.businessName} IS NULL OR (${table.businessName} <> '' AND char_length(${table.businessName}) <= 200)`,
    ),
  ],
);

export type CrmChannelIdentity = typeof crmChannelIdentities.$inferSelect;
