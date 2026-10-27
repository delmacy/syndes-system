import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

/**
 * Applies the reviewed tenant-baseline migrations to ONE tenant database.
 *
 * This is a separate release script, never part of API startup. The target
 * database URL must be resolved from trusted Control Plane data by the
 * caller/operator (client input never provides it). The Drizzle journal
 * inside the tenant database provides durable step state, so re-running
 * resumes idempotently from the last applied migration.
 *
 * The connection string is read from TENANT_DATABASE_URL and is never
 * persisted, printed, or logged.
 */

const projectDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const migrationsFolder = path.join(projectDir, 'drizzle', 'tenant');

export async function applyTenantMigrations(connectionString, folder) {
  const pool = new Pool({ connectionString });
  try {
    await migrate(drizzle(pool), { migrationsFolder: folder });
  } finally {
    await pool.end();
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (invokedDirectly) {
  const connectionString = process.env.TENANT_DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'TENANT_DATABASE_URL is required for tenant migrations.',
    );
  }

  await applyTenantMigrations(connectionString, migrationsFolder);
  console.info('Tenant migrations applied.');
}
