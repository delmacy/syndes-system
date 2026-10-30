/**
 * Standalone CRM-02 verification, suitable for the disposable PostgreSQL 16
 * API CI service (or any local disposable instance purely for verification):
 *
 * 1. Creates a disposable tenant database and a least-privilege tenant
 *    role the same way the provisioning service does (names derived per the
 *    agreed pattern, password generated in memory, PUBLIC connectivity
 *    revoked, role granted only for its own database).
 * 2. Applies tenant migrations outside API startup with the release script
 *    helper, then reapplies them to prove idempotent resume.
 * 3. Proves database/role isolation and least privilege against the real
 *    PostgreSQL 16 catalog.
 * 4. Cleans up every object it created (disposable names only).
 *
 * Credentials and connection strings are never printed: the connection is
 * read from CONTROL_PLANE_DATABASE_URL, the tenant role password is
 * generated in memory, and evidence lines carry fixed text only.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { applyTenantMigrations } from './apply-tenant-migrations.mjs';

/**
 * The catalog/provisioning checks only run when this exact file is the
 * invoked CLI entrypoint; importing this module only exposes helpers and
 * never touches a database, even without CONTROL_PLANE_DATABASE_URL.
 */
export function isInvokedEntrypoint() {
  if (!process.argv[1]) {
    return false;
  }
  const invokedHref = pathToFileURL(process.argv[1]).href;
  return process.platform === 'win32'
    ? invokedHref.toLowerCase() === import.meta.url.toLowerCase()
    : invokedHref === import.meta.url;
}

const projectDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const migrationsFolder = path.join(projectDir, 'drizzle', 'tenant');

const SAFE_NAME_PATTERN = /^[a-z_][a-z0-9_]{0,62}$/;
const PASSWORD_BYTES = 24;

function quoteIdentifier(name) {
  if (!SAFE_NAME_PATTERN.test(name)) {
    throw new Error('Unsafe disposable identifier rejected.');
  }
  return `"${name}"`;
}

function literal(value) {
  return `'${String(value).replaceAll(`'`, `''`)}'`;
}

function randomSuffix() {
  return randomUUID().replaceAll('-', '');
}

function tenantUrl(adminDatabaseUrl, databaseName) {
  const url = new URL(adminDatabaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function createAdminPool(adminDatabaseUrl) {
  return new pg.Pool({ connectionString: adminDatabaseUrl });
}

function createRolePool(adminDatabaseUrl, databaseName, roleName, password) {
  const url = new URL(adminDatabaseUrl);
  return new pg.Pool({
    host: url.hostname,
    port: Number(url.port || '5432'),
    user: roleName,
    password,
    database: databaseName,
  });
}

async function createDatabaseAndRole(
  adminDatabaseUrlDatabase,
  databaseName,
  roleName,
  password,
) {
  const adminPool = createAdminPool(adminDatabaseUrlDatabase);
  try {
    await adminPool.query(
      `CREATE DATABASE ${quoteIdentifier(databaseName)}`,
    );
    await adminPool.query(
      `CREATE ROLE ${quoteIdentifier(roleName)} LOGIN PASSWORD ${literal(password)} NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT`,
    );
    await adminPool.query(
      `REVOKE ALL ON DATABASE ${quoteIdentifier(databaseName)} FROM PUBLIC`,
    );
    await adminPool.query(
      `GRANT CONNECT ON DATABASE ${quoteIdentifier(databaseName)} TO ${quoteIdentifier(roleName)}`,
    );
  } finally {
    await adminPool.end();
  }
}

async function dropDisposableObjects(
  adminDatabaseUrl,
  databaseName,
  roleName,
) {
  const adminPool = createAdminPool(adminDatabaseUrl);
  try {
    await adminPool.query(
      `DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)} WITH (FORCE)`,
    );
    await adminPool.query(`DROP ROLE IF EXISTS ${quoteIdentifier(roleName)}`);
  } finally {
    await adminPool.end();
  }
}

const failures = [];
function check(label, ok, evidence) {
  if (ok) {
    console.info(`PASS: ${label}${evidence ? ` (${evidence})` : ''}`);
  } else {
    failures.push(label);
    console.error(`FAIL: ${label}${evidence ? ` (${evidence})` : ''}`);
  }
}

async function awaitMain(adminDatabaseUrl) {
  const suffix = randomSuffix();
  const databaseName = `sdbv_${suffix}`;
  const roleName = `tappv_${suffix}`;
  const password = randomBytes(PASSWORD_BYTES).toString('base64url');
  const siblingSuffix = randomSuffix();
  const siblingDatabaseName = `sdbv_${siblingSuffix}`;
  const siblingRoleName = `tappv_${siblingSuffix}`;

  try {
    check(
      'disposable tenant identifiers follow the strict safe pattern',
      SAFE_NAME_PATTERN.test(databaseName) && SAFE_NAME_PATTERN.test(roleName),
    );

    await createDatabaseAndRole(
      adminDatabaseUrl,
      databaseName,
      roleName,
      password,
    );
    check('disposable tenant database and role created', true);

    const adminPool = createAdminPool(adminDatabaseUrl);
    try {
      const role = await adminPool.query(
        `SELECT rolsuper, rolcreatedb, rolcreaterole, rolcanlogin FROM pg_roles WHERE rolname = $1`,
        [roleName],
      );
      check(
        'tenant role is login-only without superuser/create privileges',
        role.rowCount === 1 &&
          role.rows[0].rolcanlogin === true &&
          role.rows[0].rolsuper === false &&
          role.rows[0].rolcreatedb === false &&
          role.rows[0].rolcreaterole === false,
      );

      const grantsPool = new pg.Pool({
        connectionString: tenantUrl(adminDatabaseUrl, databaseName),
      });
      try {
        await grantsPool.query(
          `GRANT USAGE, CREATE ON SCHEMA public TO ${quoteIdentifier(roleName)}`,
        );
      } finally {
        await grantsPool.end();
      }

      const connectPrivileges = await adminPool.query(
        `SELECT has_database_privilege($1, $2, 'CONNECT') AS own_connect`,
        [roleName, databaseName],
      );
      check(
        'connect privilege on the tenant database must hold',
        connectPrivileges.rows[0]?.own_connect === true,
      );

      await applyTenantMigrations(
        tenantUrl(adminDatabaseUrl, databaseName),
        migrationsFolder,
      );
      const firstApplyTables = await tenantTableSet(
        adminDatabaseUrl,
        databaseName,
      );
      check(
        'tenant migrations apply from an empty database outside API startup',
        JSON.stringify(firstApplyTables) ===
          JSON.stringify([
            'crm_channel_identities',
            'crm_employees',
            'crm_notes',
            'crm_organizations',
            'crm_people',
            'crm_relationships',
            'crm_tag_assignments',
            'crm_tags',
            'crm_timeline_events',
            'inbox_attachments',
            'inbox_conversations',
            'inbox_messages',
            'inbox_private_notes',
            'tenant_baseline_info',
            'whatsapp_connections',
          ]),
        firstApplyTables.join(','),
      );

      await applyTenantMigrations(
        tenantUrl(adminDatabaseUrl, databaseName),
        migrationsFolder,
      );
      const secondApplyTables = await tenantTableSet(
        adminDatabaseUrl,
        databaseName,
      );
      check(
        'reapplying tenant migrations is an idempotent no-op',
        JSON.stringify(firstApplyTables) === JSON.stringify(secondApplyTables),
      );

      const tenantJournalPool = new pg.Pool({
        connectionString: tenantUrl(adminDatabaseUrl, databaseName),
      });
      try {
        const journal = await tenantJournalPool.query(
          `SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`,
        );
        check(
          'tenant drizzle journal keeps the durable migration step state',
          journal.rows[0]?.count === 8,
          `count=${journal.rows[0]?.count ?? 'missing'}`,
        );
      } finally {
        await tenantJournalPool.end();
      }

      let roleCreateDbDenied = false;
      try {
        const roleProbePool = createRolePool(
          adminDatabaseUrl,
          databaseName,
          roleName,
          password,
        );
        try {
          await roleProbePool.query('CREATE DATABASE probe_never_created');
        } finally {
          await roleProbePool.end();
        }
      } catch {
        roleCreateDbDenied = true;
      }
      check('tenant role cannot create databases', roleCreateDbDenied);

      const rolePool = createRolePool(
        adminDatabaseUrl,
        databaseName,
        roleName,
        password,
      );
      let roleSession = '';
      try {
        const session = await rolePool.query('SELECT current_user');
        roleSession = session.rows[0]?.current_user ?? '';
      } finally {
        await rolePool.end();
      }
      check(
        'tenant role can connect to its own database with the stored credential',
        roleSession === roleName,
        roleSession,
      );

      await createDatabaseAndRole(
        adminDatabaseUrl,
        siblingDatabaseName,
        siblingRoleName,
        randomBytes(PASSWORD_BYTES).toString('base64url'),
      );
      const crossTenant = await adminPool.query(
        `SELECT has_database_privilege($1, $2, 'CONNECT') AS cross_connect`,
        [roleName, siblingDatabaseName],
      );
      check(
        'tenant role cannot connect to another tenant database',
        crossTenant.rows[0]?.cross_connect === false,
      );
    } finally {
      await adminPool.end();
    }
  } catch (error) {
    console.error(
      'Tenant provisioning verification failed without exposing credentials.',
    );
    failures.push(error instanceof Error ? error.name : String(typeof error));
  } finally {
    await dropDisposableObjects(adminDatabaseUrl, databaseName, roleName);
    await dropDisposableObjects(
      adminDatabaseUrl,
      siblingDatabaseName,
      siblingRoleName,
    );
  }

  if (failures.length > 0) {
    console.error(`Verification failures: ${failures.length}`);
    process.exitCode = 1;
    return;
  }
  console.info('Tenant provisioning verification completed.');
}

async function tenantTableSet(adminDatabaseUrl, databaseName) {
  const tenantPool = new pg.Pool({
    connectionString: tenantUrl(adminDatabaseUrl, databaseName),
  });
  try {
    const { rows } = await tenantPool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    return rows.map((row) => row.table_name);
  } finally {
    await tenantPool.end();
  }
}

(async () => {
  if (!isInvokedEntrypoint()) {
    return;
  }
  const adminDatabaseUrl = process.env.CONTROL_PLANE_DATABASE_URL;
  if (!adminDatabaseUrl) {
    console.error(
      'CONTROL_PLANE_DATABASE_URL is required for tenant provisioning verification.',
    );
    process.exit(1);
  }
  await awaitMain(adminDatabaseUrl);
})();
