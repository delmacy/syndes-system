import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Control Plane tenant registry (PRD-001 Stage 1, slice 1).
 *
 * This schema belongs to the Control Plane database only. It never stores
 * credentials or secrets; the tenant database reference stored here is a
 * non-secret database name resolved server-side.
 */

export const PROVISIONING_STATES = [
  'pending',
  'in_progress',
  'ready',
  'failed',
] as const;

export type ProvisioningState = (typeof PROVISIONING_STATES)[number];

export const provisioningState = pgEnum(
  'provisioning_state',
  PROVISIONING_STATES,
);

/**
 * Stable tenant identity:
 * - `id` is a permanent UUID and never depends on the display name.
 * - `displayName` is display information only and is not an identifier.
 * - `databaseName` is the unique, non-secret reference that resolves the
 *   tenant's own PostgreSQL database.
 */
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  displayName: text('display_name').notNull(),
  databaseName: text('database_name').notNull().unique(),
  provisioningState: provisioningState('provisioning_state')
    .notNull()
    .default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
