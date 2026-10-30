import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const describeControlPlane = process.env.CONTROL_PLANE_DATABASE_URL
  ? describe
  : describe.skip;

jest.setTimeout(30_000);

/**
 * CRM-06 migration proof over disposable PostgreSQL 16: the reviewed tenant
 * migrations apply the Core CRM baseline to an empty tenant database and
 * reapplying it is an idempotent no-op. Runs whenever a disposable
 * CONTROL_PLANE_DATABASE_URL is available (the existing CI workflow), and is
 * skipped otherwise.
 */
describeControlPlane(
  'CRM-06 tenant CRM migration (disposable PostgreSQL)',
  () => {
    const projectDir = process.cwd();
    const tenantApplyScript = path.join(
      projectDir,
      'scripts',
      'apply-tenant-migrations.mjs',
    );

    const databaseName = `crm06mig_${process.pid}_${Date.now()
      .toString(36)
      .slice(-8)}`;
    const roleName = `crm06migrole_${Date.now().toString(36).slice(-8)}`;
    const baselineDatabaseName = `${databaseName}_base`;
    const baselineMigrationsFolder = path.join(
      os.tmpdir(),
      `crm06-baseline-${process.pid}-${Date.now().toString(36)}`,
    );
    const migrationsFolder = path.join(projectDir, 'drizzle', 'tenant');

    let adminPool: Pool;
    let migrationUrl: URL;

    beforeAll(async () => {
      migrationUrl = new URL(process.env.CONTROL_PLANE_DATABASE_URL!);
      migrationUrl.pathname = `/${databaseName}`;
      adminPool = new Pool({
        connectionString: process.env.CONTROL_PLANE_DATABASE_URL,
      });
      await adminPool.query(`CREATE DATABASE "${databaseName}"`);
      await adminPool.query(`CREATE DATABASE "${baselineDatabaseName}"`);
    });

    afterAll(async () => {
      try {
        await adminPool?.query(
          `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`,
        );
        await adminPool?.query(
          `DROP DATABASE IF EXISTS "${baselineDatabaseName}" WITH (FORCE)`,
        );
        await adminPool?.query(`DROP ROLE IF EXISTS "${roleName}"`);
      } finally {
        await rm(baselineMigrationsFolder, { recursive: true, force: true });
        await adminPool?.end();
      }
    });

    function applyTenantMigrations(): void {
      execFileSync(process.execPath, [tenantApplyScript], {
        env: {
          ...process.env,
          TENANT_DATABASE_URL: migrationUrl.toString(),
        },
        stdio: 'inherit',
        cwd: projectDir,
      });
    }

    async function tableSet(): Promise<string[]> {
      const pool = new Pool({ connectionString: migrationUrl.toString() });
      try {
        const { rows } = await pool.query<{ table_name: string }>(
          `SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
          ORDER BY table_name`,
        );
        return rows.map((row) => row.table_name);
      } finally {
        await pool.end();
      }
    }

    const expectedTables = [
      'crm_channel_identities',
      'crm_employees',
      'crm_notes',
      'crm_organizations',
      'crm_people',
      'crm_relationships',
      'crm_tag_assignments',
      'crm_tags',
      'crm_timeline_events',
      // INBOX-02 baseline tables (same tenant database, no tenant_id columns).
      // INBOX-04 private attachment metadata (bytes stay outside PostgreSQL).
      'inbox_attachments',
      'inbox_conversations',
      'inbox_messages',
      'inbox_private_notes',
      'tenant_baseline_info',
      'whatsapp_connections',
    ];

    it('applies the CRM-05 and CRM-06 schema migrations to an empty database', async () => {
      applyTenantMigrations();
      const tables = await tableSet();
      expect(tables).toEqual(expectedTables);
    });

    it('reapplies tenant migrations as an idempotent no-op', async () => {
      applyTenantMigrations();
      expect(await tableSet()).toEqual(expectedTables);
    });

    it('applies CRM-06 on top of the existing CRM-05 tenant baseline', async () => {
      const journal = JSON.parse(
        await readFile(
          path.join(migrationsFolder, 'meta', '_journal.json'),
          'utf8',
        ),
      ) as { entries: { tag: string }[] };
      const baselineEntries = journal.entries.slice(0, 2);
      const baselineFolder = path.join(baselineMigrationsFolder, 'meta');
      await mkdir(baselineFolder, { recursive: true });
      await writeFile(
        path.join(baselineFolder, '_journal.json'),
        JSON.stringify({ ...journal, entries: baselineEntries }, null, 2),
      );
      for (const entry of baselineEntries) {
        await copyFile(
          path.join(migrationsFolder, `${entry.tag}.sql`),
          path.join(baselineMigrationsFolder, `${entry.tag}.sql`),
        );
      }

      const baselineUrl = new URL(process.env.CONTROL_PLANE_DATABASE_URL!);
      baselineUrl.pathname = `/${baselineDatabaseName}`;
      const baselinePool = new Pool({
        connectionString: baselineUrl.toString(),
      });
      try {
        await migrate(drizzle(baselinePool), {
          migrationsFolder: baselineMigrationsFolder,
        });
      } finally {
        await baselinePool.end();
      }

      execFileSync(process.execPath, [tenantApplyScript], {
        env: {
          ...process.env,
          TENANT_DATABASE_URL: baselineUrl.toString(),
        },
        stdio: 'inherit',
        cwd: projectDir,
      });
      const pool = new Pool({ connectionString: baselineUrl.toString() });
      try {
        const { rows } = await pool.query<{ table_name: string }>(
          `SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
           ORDER BY table_name`,
        );
        expect(rows.map((row) => row.table_name)).toEqual(expectedTables);
      } finally {
        await pool.end();
      }
    });
  },
);
