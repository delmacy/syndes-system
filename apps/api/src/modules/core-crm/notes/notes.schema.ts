import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { crmOrganizations } from '../tenant-crm.schema';
import { crmPeople } from '../tenant-crm.schema';

/**
 * CRM-06 notes (tenant database only). A Note attaches to exactly one
 * approved CRM target (Person or Organization); its body is the only
 * mutable content and there is no delete path in the MVP.
 */
export const crmNotes = pgTable(
  'crm_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id').references(() => crmPeople.id),
    organizationId: uuid('organization_id').references(
      () => crmOrganizations.id,
    ),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('crm_notes_person_idx').on(table.personId),
    index('crm_notes_organization_idx').on(table.organizationId),
    check(
      'crm_notes_body_check',
      sql`${table.body} <> '' AND char_length(${table.body}) <= 10000`,
    ),
    check(
      'crm_notes_single_target_check',
      sql`(${table.personId} IS NOT NULL AND ${table.organizationId} IS NULL) OR (${table.personId} IS NULL AND ${table.organizationId} IS NOT NULL)`,
    ),
  ],
);

export type CrmNote = typeof crmNotes.$inferSelect;
