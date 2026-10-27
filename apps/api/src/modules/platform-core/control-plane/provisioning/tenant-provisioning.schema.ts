import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenants } from '../tenant-registry.schema';

/**
 * CRM-02 durable per-attempt provisioning record.
 *
 * This table is owned by the provisioning slice. It stores only:
 * - the durable attempt stage (sanitized stable stage codes);
 * - one sanitized, stable failure code per attempt (never raw exception
 *   text, SQL, credentials, connection strings, or a duplicate lifecycle
 *   state — `tenants.provisioning_state` stays the canonical state).
 *
 * The tenant registry keeps its CRM-01 identity and columns unchanged.
 */
export const tenantProvisioning = pgTable('tenant_provisioning', {
  tenantId: uuid('tenant_id')
    .primaryKey()
    .references(() => tenants.id),
  attempt: integer('attempt').notNull().default(1),
  stage: text('stage').notNull(),
  failureCode: text('failure_code'),
  startedAt: timestamp('started_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
});

export type TenantProvisioningRow = typeof tenantProvisioning.$inferSelect;
