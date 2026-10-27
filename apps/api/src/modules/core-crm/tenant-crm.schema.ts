import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * CRM-05 Core CRM tenant schema (tenant PostgreSQL database only).
 *
 * Definitions mirror the reviewed tenant migration in
 * `apps/api/drizzle/tenant/`. There is no tenant_id column by design:
 * every request is routed to exactly one tenant database server-side
 * (TenantContext), so tenant isolation is enforced by database routing,
 * never by client-controlled identifiers.
 */

export const crmOrganizations = pgTable(
  'crm_organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    cnpj: text('cnpj'),
    email: text('email'),
    phone: text('phone'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('crm_organizations_cnpj_unique')
      .on(table.cnpj)
      .where(sql`${table.cnpj} IS NOT NULL`),
    index('crm_organizations_name_idx').on(table.name),
    check(
      'crm_organizations_name_check',
      sql`${table.name} <> '' AND char_length(${table.name}) <= 200`,
    ),
    check(
      'crm_organizations_email_check',
      sql`${table.email} IS NULL OR (${table.email} <> '' AND char_length(${table.email}) <= 320 AND ${table.email} ~ '.+@.+[a-z]')`,
    ),
    check(
      'crm_organizations_phone_check',
      sql`${table.phone} IS NULL OR (${table.phone} <> '' AND char_length(${table.phone}) <= 32)`,
    ),
    check(
      'crm_organizations_cnpj_check',
      sql`${table.cnpj} IS NULL OR (${table.cnpj} <> '' AND char_length(${table.cnpj}) <= 20)`,
    ),
  ],
);

export const crmPeople = pgTable(
  'crm_people',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fullName: text('full_name').notNull(),
    cpf: text('cpf'),
    email: text('email'),
    phone: text('phone'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('crm_people_cpf_unique')
      .on(table.cpf)
      .where(sql`${table.cpf} IS NOT NULL`),
    index('crm_people_full_name_idx').on(table.fullName),
    check(
      'crm_people_full_name_check',
      sql`${table.fullName} <> '' AND char_length(${table.fullName}) <= 200`,
    ),
    check(
      'crm_people_email_check',
      sql`${table.email} IS NULL OR (${table.email} <> '' AND char_length(${table.email}) <= 320 AND ${table.email} ~ '.+@.+[a-z]')`,
    ),
    check(
      'crm_people_phone_check',
      sql`${table.phone} IS NULL OR (${table.phone} <> '' AND char_length(${table.phone}) <= 32)`,
    ),
    check(
      'crm_people_cpf_check',
      sql`${table.cpf} IS NULL OR (${table.cpf} <> '' AND char_length(${table.cpf}) <= 20)`,
    ),
  ],
);

/**
 * Person <-> Organization contact link. Person and Organization records are
 * never hard deleted in the MVP; relationship rows are removed only by the
 * approved CRM-05 remove operation.
 */
export const crmRelationships = pgTable(
  'crm_relationships',
  {
    personId: uuid('person_id')
      .notNull()
      .references(() => crmPeople.id),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => crmOrganizations.id),
    role: text('role').notNull().default('contact'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'crm_relationships_person_org_pk',
      columns: [table.personId, table.organizationId],
    }),
    index('crm_relationships_organization_idx').on(table.organizationId),
    index('crm_relationships_person_idx').on(table.personId),
    check('crm_relationships_role_check', sql`${table.role} IN ('contact')`),
  ],
);

/**
 * Tenant staff/attendant profile. Employee is NOT a login and stores no
 * credentials: the optional control_plane_actor_id only references the
 * Control Plane actor UUID (no cross-database key enforcement possible).
 */
export const crmEmployees = pgTable(
  'crm_employees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    displayName: text('display_name').notNull(),
    active: boolean('active').notNull().default(true),
    controlPlaneActorId: uuid('control_plane_actor_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('crm_employees_actor_unique')
      .on(table.controlPlaneActorId)
      .where(sql`${table.controlPlaneActorId} IS NOT NULL`),
    check(
      'crm_employees_display_name_check',
      sql`${table.displayName} <> '' AND char_length(${table.displayName}) <= 200`,
    ),
  ],
);

export type CrmOrganization = typeof crmOrganizations.$inferSelect;
export type NewCrmOrganization = typeof crmOrganizations.$inferInsert;
export type CrmPerson = typeof crmPeople.$inferSelect;
export type NewCrmPerson = typeof crmPeople.$inferInsert;
export type CrmRelationship = typeof crmRelationships.$inferSelect;
export type CrmEmployee = typeof crmEmployees.$inferSelect;
