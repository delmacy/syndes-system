import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const projectDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const migrationsFolder = path.join(projectDir, 'drizzle', 'control-plane');

const connectionString = process.env.CONTROL_PLANE_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'CONTROL_PLANE_DATABASE_URL is required for Control Plane migrations.',
  );
}

const pool = new Pool({ connectionString });

try {
  await migrate(drizzle(pool), {
    migrationsFolder,
  });
  console.info('Control Plane migrations applied.');
} catch {
  console.error('Control Plane migration failed. Check the database logs.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
