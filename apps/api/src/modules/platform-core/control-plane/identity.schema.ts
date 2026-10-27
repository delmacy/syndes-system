import {
  boolean,
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenant-registry.schema';

export const identityActors = pgTable(
  'identity_actors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    issuer: text('issuer').notNull(),
    subject: text('subject').notNull(),
    platformAdmin: boolean('platform_admin').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('identity_actors_issuer_subject_unique').on(
      table.issuer,
      table.subject,
    ),
  ],
);

export const tenantDomains = pgTable(
  'tenant_domains',
  {
    hostname: text('hostname').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'tenant_domains_status_check',
      sql`${table.status} IN ('active', 'disabled')`,
    ),
    check(
      'tenant_domains_hostname_normalized_check',
      sql`${table.hostname} = lower(${table.hostname}) AND ${table.hostname} !~ '[[:space:]/\\\\]'`,
    ),
  ],
);

export const tenantMemberships = pgTable(
  'tenant_memberships',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => identityActors.id),
    role: text('role').notNull(),
    customerScope: text('customer_scope').notNull().default('both'),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'tenant_memberships_tenant_actor_pk',
      columns: [table.tenantId, table.actorId],
    }),
    index('tenant_memberships_actor_status_idx').on(
      table.actorId,
      table.status,
    ),
    check(
      'tenant_memberships_role_check',
      sql`${table.role} IN ('tenant_admin', 'tenant_member')`,
    ),
    check(
      'tenant_memberships_scope_check',
      sql`${table.customerScope} IN ('cpf', 'pj', 'both')`,
    ),
    check(
      'tenant_memberships_status_check',
      sql`${table.status} IN ('active', 'revoked')`,
    ),
    check(
      'tenant_memberships_admin_scope_check',
      sql`${table.role} <> 'tenant_admin' OR ${table.customerScope} = 'both'`,
    ),
  ],
);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id),
    actorId: uuid('actor_id').references(() => identityActors.id),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    result: text('result').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('audit_events_tenant_time_idx').on(table.tenantId, table.occurredAt),
    check(
      'audit_events_result_check',
      sql`${table.result} IN ('success', 'denied', 'failure')`,
    ),
  ],
);
