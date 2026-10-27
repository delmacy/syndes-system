/**
 * Control Plane migration contract verification.
 *
 * Runs against the disposable PostgreSQL service configured for the API CI
 * workflow (or any locally disposable instance purely for this verification).
 * It proves, against a real PostgreSQL 16 catalog:
 *
 * 1. Migrations apply from an empty database and create the expected
 *    enum/table/constraints.
 * 2. Reapplying the migrator duplicates nothing (idempotent execution).
 * 3. The registry object set is exactly the approved Control Plane handoff.
 * 4. Defaults behave as declared (insert probe rolled back immediately).
 *
 * The script never persists, prints, or returns connection credentials: the
 * connection string is read from CONTROL_PLANE_DATABASE_URL and only fixed
 * evidence lines are emitted. The insert probe uses a unique disposable
 * database_name and runs inside a single transaction that is always rolled
 * back, so no existing rows are ever destructively mutated.
 *
 * The catalog checks only run when this exact file is the invoked CLI
 * entrypoint; importing this module only exposes the pure helpers and never
 * touches a database, even without CONTROL_PLANE_DATABASE_URL.
 */

import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import pg from 'pg';

const projectDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const applyScript = path.join(
  projectDir,
  'scripts',
  'apply-control-plane-migrations.mjs',
);

export const EXPECTED_PROVISIONING_STATES = [
  'pending',
  'in_progress',
  'ready',
  'failed',
];

export const EXPECTED_TENANT_COLUMNS = [
  'id',
  'display_name',
  'database_name',
  'provisioning_state',
  'created_at',
  'updated_at',
];

export const EXPECTED_TENANT_PROVISIONING_COLUMNS = [
  'tenant_id',
  'attempt',
  'stage',
  'failure_code',
  'started_at',
  'updated_at',
  'finished_at',
];

/**
 * Length of the reviewed Control Plane journal (CRM-01 registry slice plus
 * the CRM-02 durable provisioning-attempt slice).
 */
export const EXPECTED_CRM03_TABLES = ['audit_events', 'identity_actors', 'tenant_domains', 'tenant_memberships'];
export const EXPECTED_CONTROL_PLANE_MIGRATIONS = 3;

export function normalizeOrderedSet(values) {
  return [...values]
    .map((value) => String(value).trim().toLowerCase())
    .sort();
}

export function columnsMatchExpected(actual) {
  return (
    JSON.stringify(normalizeOrderedSet(actual)) ===
    JSON.stringify(normalizeOrderedSet(EXPECTED_TENANT_COLUMNS))
  );
}

export function provisioningColumnsMatchExpected(actual) {
  return (
    JSON.stringify(normalizeOrderedSet(actual)) ===
    JSON.stringify(normalizeOrderedSet(EXPECTED_TENANT_PROVISIONING_COLUMNS))
  );
}

export function makeProbeDatabaseName() {
  return `probe_migration_verification_${randomUUID().replaceAll('-', '')}`;
}

const failures = [];
function check(label, ok, evidence) {
  if (ok) {
    console.info(`PASS: ${label}${evidence ? ` (${evidence})` : ''}`);
  } else {
    failures.push(`${label}${evidence ? ` (${evidence})` : ''}`);
    console.error(`FAIL: ${label}${evidence ? ` (${evidence})` : ''}`);
  }
}

async function snapshot(pool) {
  const { rows: enums } = await pool.query(
    `SELECT enumlabel FROM pg_enum e
     JOIN pg_type t ON t.oid = e.enumtypid
     JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public' AND t.typname = 'provisioning_state'
     ORDER BY enumsortorder`,
  );
  const { rows: enumTypes } = await pool.query(
    `SELECT t.typname FROM pg_type t
     JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public' AND t.typtype = 'e'
     ORDER BY t.typname`,
  );
    const { rows: tables } = await pool.query(
      `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
    );
    const { rows: columns } = await pool.query(
      `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tenants'
      ORDER BY ordinal_position`,
    );
    const { rows: provisioningColumns } = await pool.query(
      `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tenant_provisioning'
      ORDER BY ordinal_position`,
    );
    const { rows: provisioningForeignKeys } = await pool.query(
      `SELECT conname FROM pg_constraint
      WHERE conrelid = '"tenant_provisioning"'::regclass AND contype = 'f'
      ORDER BY conname`,
    );
    const { rows: uniqueConstraints } = await pool.query(
      `SELECT conname FROM pg_constraint
      WHERE conrelid = '"tenants"'::regclass AND contype = 'u'
      ORDER BY conname`,
    );
    let journalCount = 0;
    try {
      const { rows } = await pool.query(
        'SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations',
      );
      journalCount = rows[0]?.count ?? 0;
    } catch {
      journalCount = null;
    }
    const { rows: identityColumns } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'identity_actors' ORDER BY ordinal_position`);
    const { rows: membershipColumns } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_memberships' ORDER BY ordinal_position`);
    const { rows: domainColumns } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_domains' ORDER BY ordinal_position`);
    const { rows: auditColumns } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_events' ORDER BY ordinal_position`);
    const { rows: crm03Constraints } = await pool.query(`SELECT conname FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND conname IN ('identity_actors_issuer_subject_unique', 'tenant_domains_status_check', 'tenant_domains_hostname_normalized_check', 'tenant_memberships_role_check', 'tenant_memberships_scope_check', 'tenant_memberships_status_check', 'tenant_memberships_admin_scope_check', 'audit_events_result_check') ORDER BY conname`);
    return {
      enumValues: enums.map((row) => row.enumlabel),
      enumTypes: enumTypes.map((row) => row.typname),
      tables: tables.map((row) => row.table_name),
      columns: columns.map((row) => row.column_name),
      provisioningColumns: provisioningColumns.map((row) => row.column_name),
      provisioningForeignKeys: provisioningForeignKeys.map(
        (row) => row.conname,
      ),
      uniqueConstraints: uniqueConstraints.map((row) => row.conname),
      identityColumns: identityColumns.map((row) => row.column_name),
      membershipColumns: membershipColumns.map((row) => row.column_name),
      domainColumns: domainColumns.map((row) => row.column_name),
      auditColumns: auditColumns.map((row) => row.column_name),
      crm03Constraints: crm03Constraints.map((row) => row.conname),
      journalCount,
    };
  }

export function isInvokedEntrypoint() {
  if (!process.argv[1]) {
    return false;
  }
  const invokedHref = pathToFileURL(process.argv[1]).href;
  return process.platform === 'win32'
    ? invokedHref.toLowerCase() === import.meta.url.toLowerCase()
    : invokedHref === import.meta.url;
}

if (isInvokedEntrypoint()) {
  const connectionString = process.env.CONTROL_PLANE_DATABASE_URL;

  if (!connectionString) {
    console.error(
      'CONTROL_PLANE_DATABASE_URL is required for Control Plane migration verification.',
    );
    process.exit(1);
  }

  function reapplyMigrations() {
    execFileSync(process.execPath, [applyScript], {
      cwd: projectDir,
      stdio: 'inherit',
    });
  }

  const pool = new pg.Pool({ connectionString });

  try {
    reapplyMigrations();
    const before = await snapshot(pool);

    reapplyMigrations();
    const after = await snapshot(pool);

    check(
      'reapplying the migrator produced identical catalog objects',
      JSON.stringify(before) === JSON.stringify(after),
    );
    check(
      'provisioning_state enum values match the approved handoff',
      JSON.stringify(normalizeOrderedSet(before.enumValues)) ===
        JSON.stringify(normalizeOrderedSet(EXPECTED_PROVISIONING_STATES)),
      before.enumValues.join(','),
    );
    check(
      'public enum object set is exactly provisioning_state',
      JSON.stringify(before.enumTypes) === JSON.stringify(['provisioning_state']),
      before.enumTypes.join(','),
    );
    check(
      'public table object set is exactly the reviewed Control Plane tables',
      JSON.stringify(normalizeOrderedSet(before.tables)) ===
        JSON.stringify(normalizeOrderedSet(['tenants', 'tenant_provisioning', ...EXPECTED_CRM03_TABLES])),
      before.tables.join(','),
    );
    check(
      'tenants columns match the approved handoff without credential columns',
      columnsMatchExpected(before.columns),
      normalizeOrderedSet(before.columns).join(','),
    );
    check(
      'tenant_provisioning columns match the CRM-02 handoff without credential columns',
      provisioningColumnsMatchExpected(before.provisioningColumns),
      normalizeOrderedSet(before.provisioningColumns).join(','),
    );
    check(
      'tenant_provisioning keeps exactly its foreign key to tenants',
      JSON.stringify(before.provisioningForeignKeys) ===
        JSON.stringify(['tenant_provisioning_tenant_id_tenants_id_fk']),
      before.provisioningForeignKeys.join(','),
    );
    check('identity actor columns match the approved mapping contract', JSON.stringify(normalizeOrderedSet(before.identityColumns)) === JSON.stringify(normalizeOrderedSet(['id', 'issuer', 'subject', 'platform_admin', 'created_at'])), normalizeOrderedSet(before.identityColumns).join(','));
    check('tenant membership columns match the fixed role and scope contract', JSON.stringify(normalizeOrderedSet(before.membershipColumns)) === JSON.stringify(normalizeOrderedSet(['tenant_id', 'actor_id', 'role', 'customer_scope', 'status', 'created_at', 'updated_at'])), normalizeOrderedSet(before.membershipColumns).join(','));
    check('tenant hostname mapping columns match the approved contract', JSON.stringify(normalizeOrderedSet(before.domainColumns)) === JSON.stringify(normalizeOrderedSet(['hostname', 'tenant_id', 'status', 'created_at'])), normalizeOrderedSet(before.domainColumns).join(','));
    check('audit event columns exclude request payloads and credentials', JSON.stringify(normalizeOrderedSet(before.auditColumns)) === JSON.stringify(normalizeOrderedSet(['id', 'tenant_id', 'actor_id', 'action', 'resource_type', 'resource_id', 'result', 'occurred_at'])), normalizeOrderedSet(before.auditColumns).join(','));
    check('CRM-03 identity and authorization constraints are installed', before.crm03Constraints.length === 8, before.crm03Constraints.join(','));
    check(
      'tenants unique-constraint set is exactly tenants_database_name_unique',
      JSON.stringify(before.uniqueConstraints) ===
        JSON.stringify(['tenants_database_name_unique']),
      before.uniqueConstraints.join(','),
    );
    check(
      'drizzle journal records every reviewed migration as applied',
      before.journalCount === EXPECTED_CONTROL_PLANE_MIGRATIONS,
      `journalCount=${before.journalCount}`,
    );

    const probeDatabaseName = makeProbeDatabaseName();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO tenants (display_name, database_name)
         VALUES ($1, $2)
         RETURNING id, provisioning_state, created_at`,
        ['Migration verification probe', probeDatabaseName],
      );
      const probe = rows[0];
      check(
        'insert probe got valid tenant id and pending default state',
        Boolean(
          probe &&
            /^[0-9a-f-]{36}$/i.test(probe.id ?? '') &&
            probe.provisioning_state === 'pending' &&
            probe.created_at instanceof Date,
        ),
        probe ? `state=${probe.provisioning_state}` : 'no row returned',
      );
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
    console.info(
      'Control Plane migration contract verified (probe row rolled back).',
    );
  } catch (error) {
    failures.push(
      `Unexpected verification error: ${error instanceof Error ? error.message : String(error)}`,
    );
    console.error(
      'Control Plane migration verification failed without exposing credentials.',
    );
  } finally {
    await pool.end();
  }

  if (failures.length > 0) {
    console.error(`Verification failures: ${failures.length}`);
    process.exitCode = 1;
  }
}
