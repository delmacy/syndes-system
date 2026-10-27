import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Pool } from 'pg';

/**
 * Runs the reviewed tenant-baseline migrations against a single tenant
 * database using the approved Drizzle PostgreSQL migrator.
 *
 * This runner is invoked only from the provisioning service AFTER a tenant
 * is claimed under its per-tenant lock, or from the separate
 * `tenant:migrations:apply` release script. It never runs during API
 * startup. The Drizzle journal inside the tenant database is the durable
 * step state, so repeated runs resume idempotently from the last applied
 * migration.
 */

export const DEFAULT_TENANT_MIGRATIONS_FOLDER = path.resolve(
  process.cwd(),
  'drizzle',
  'tenant',
);

export async function runTenantMigrations(
  pool: Pool,
  migrationsFolder: string = DEFAULT_TENANT_MIGRATIONS_FOLDER,
): Promise<void> {
  await migrate(drizzle(pool), { migrationsFolder });
}
