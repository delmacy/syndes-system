import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const whatsappConnections = pgTable(
  'whatsapp_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    singletonKey: text('singleton_key').notNull().default('default').unique(),
    provider: text('provider').notNull().default('whatsmeow'),
    status: text('status').notNull().default('disconnected'),
    phoneExternalId: text('phone_external_id'),
    sessionSecretRef: text('session_secret_ref'),
    configured: boolean('configured').notNull().default(false),
    authorized: boolean('authorized').notNull().default(false),
    serviceEnabled: boolean('service_enabled').notNull().default(true),
    suspensionReason: text('suspension_reason'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('whatsapp_connections_status_idx').on(table.status),
    // Each tenant database may hold exactly one WhatsApp connection.
    // Tenant routing is the isolation boundary, so this is a singleton key.
    check(
      'whatsapp_connections_provider_check',
      sql`${table.provider} IN ('fake', 'whatsmeow')`,
    ),
    check(
      'whatsapp_connections_status_check',
      sql`${table.status} IN ('disconnected', 'pairing', 'connected', 'suspended', 'error')`,
    ),
    check(
      'whatsapp_connections_authorization_check',
      sql`NOT ${table.authorized} OR ${table.configured}`,
    ),
    check(
      'whatsapp_connections_connected_check',
      sql`${table.status} <> 'connected' OR (${table.authorized} AND ${table.serviceEnabled})`,
    ),
    check(
      'whatsapp_connections_suspension_check',
      sql`(${table.serviceEnabled} AND ${table.suspensionReason} IS NULL) OR (NOT ${table.serviceEnabled} AND ${table.status} = 'suspended' AND ${table.suspensionReason} = 'delinquency')`,
    ),
  ],
);
