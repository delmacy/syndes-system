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
import { crmOrganizations } from '../tenant-crm.schema';
import { crmPeople } from '../tenant-crm.schema';

/**
 * CRM-06 tags and tag assignments (tenant database only). A Tag is a
 * tenant workspace label; assignments attach it to exactly one approved
 * CRM target (Person or Organization) and nothing else. CRM targets are
 * never hard deleted, so assignment rows keep their foreign keys intact.
 */
export const crmTags = pgTable(
  'crm_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    color: text('color'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('crm_tags_name_unique').on(table.name),
    check(
      'crm_tags_name_check',
      sql`${table.name} <> '' AND char_length(${table.name}) <= 100`,
    ),
    check(
      'crm_tags_color_check',
      sql`((${table.color}) IS NULL OR ((${table.color}) ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'))`,
    ),
  ],
);

export const crmTagAssignments = pgTable(
  'crm_tag_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => crmTags.id),
    personId: uuid('person_id').references(() => crmPeople.id),
    organizationId: uuid('organization_id').references(
      () => crmOrganizations.id,
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('crm_tag_assignments_tag_idx').on(table.tagId),
    index('crm_tag_assignments_person_idx').on(table.personId),
    index('crm_tag_assignments_organization_idx').on(table.organizationId),
    uniqueIndex('crm_tag_assignments_person_unique')
      .on(table.tagId, table.personId)
      .where(sql`${table.personId} IS NOT NULL`),
    uniqueIndex('crm_tag_assignments_organization_unique')
      .on(table.tagId, table.organizationId)
      .where(sql`${table.organizationId} IS NOT NULL`),
    check(
      'crm_tag_assignments_single_target_check',
      sql`(${table.personId} IS NOT NULL AND ${table.organizationId} IS NULL) OR (${table.personId} IS NULL AND ${table.organizationId} IS NOT NULL)`,
    ),
  ],
);

export type CrmTag = typeof crmTags.$inferSelect;
export type CrmTagAssignment = typeof crmTagAssignments.$inferSelect;
