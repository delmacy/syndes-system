import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * CRM-06 append-only Timeline event store (tenant database only).
 *
 * Each row holds only what the CRM-00 contract froze for rendering the
 * chronological CRM history: event kind, affected CRM identifiers, the
 * Control Plane actor id and the occurrence time. Mutable CRM fields are
 * never copied here; Person/Organization/etc. tables stay canonical, and
 * the Control Plane audit remains a separate security record. There is no
 * update or delete path: rows are inserted in the same tenant transaction
 * as the mutation they describe.
 *
 * `clock_timestamp()` (not `now()`) keeps wall-clock microsecond
 * resolution so multiple events within one transaction are ordered by
 * actual insertion time.
 */

export const TIMELINE_EVENT_KINDS = [
  'person.created',
  'person.updated',
  'person.archived',
  'organization.created',
  'organization.updated',
  'organization.archived',
  'relationship.created',
  'relationship.removed',
  'tag.attached',
  'tag.detached',
  'note.created',
] as const;

export type TimelineEventKind = (typeof TIMELINE_EVENT_KINDS)[number];

export const crmTimelineEvents = pgTable(
  'crm_timeline_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventKind: text('event_kind').notNull(),
    actorId: uuid('actor_id').notNull(),
    personId: uuid('person_id'),
    organizationId: uuid('organization_id'),
    tagId: uuid('tag_id'),
    noteId: uuid('note_id'),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (table) => [
    index('crm_timeline_events_person_time_idx').on(
      table.personId,
      table.occurredAt,
      table.id,
    ),
    index('crm_timeline_events_organization_time_idx').on(
      table.organizationId,
      table.occurredAt,
      table.id,
    ),
    index('crm_timeline_events_kind_idx').on(table.eventKind),
    check(
      'crm_timeline_events_kind_check',
      sql`${table.eventKind} IN ('person.created', 'person.updated', 'person.archived', 'organization.created', 'organization.updated', 'organization.archived', 'relationship.created', 'relationship.removed', 'tag.attached', 'tag.detached', 'note.created')`,
    ),
    check(
      'crm_timeline_events_target_check',
      sql`${table.personId} IS NOT NULL OR ${table.organizationId} IS NOT NULL`,
    ),
  ],
);

export type CrmTimelineEvent = typeof crmTimelineEvents.$inferSelect;
