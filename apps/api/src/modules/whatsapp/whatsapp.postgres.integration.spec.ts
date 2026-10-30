import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { Pool } from 'pg';

const describePostgres = process.env.CONTROL_PLANE_DATABASE_URL
  ? describe
  : describe.skip;

jest.setTimeout(30_000);

describePostgres('WA-01 WhatsApp persistence (disposable PostgreSQL)', () => {
  const suffix = `${process.pid}_${Date.now().toString(36)}`;
  const databaseA = `wa_a_${suffix}`;
  const databaseB = `wa_b_${suffix}`;
  const adminUrl = process.env.CONTROL_PLANE_DATABASE_URL!;
  const admin = new Pool({ connectionString: adminUrl });
  const applyScript = path.join(
    process.cwd(),
    'scripts',
    'apply-tenant-migrations.mjs',
  );

  function databaseUrl(name: string): string {
    const url = new URL(adminUrl);
    url.pathname = `/${name}`;
    return url.toString();
  }

  beforeAll(async () => {
    await admin.query(`CREATE DATABASE "${databaseA}"`);
    await admin.query(`CREATE DATABASE "${databaseB}"`);
    for (const databaseName of [databaseA, databaseB]) {
      execFileSync(process.execPath, [applyScript], {
        cwd: process.cwd(),
        env: { ...process.env, TENANT_DATABASE_URL: databaseUrl(databaseName) },
        stdio: 'inherit',
      });
    }
  });

  afterAll(async () => {
    await admin.query(`DROP DATABASE IF EXISTS "${databaseA}" WITH (FORCE)`);
    await admin.query(`DROP DATABASE IF EXISTS "${databaseB}" WITH (FORCE)`);
    await admin.end();
  });

  it('enforces one connection independently inside each tenant database', async () => {
    const tenantA = new Pool({ connectionString: databaseUrl(databaseA) });
    const tenantB = new Pool({ connectionString: databaseUrl(databaseB) });
    try {
      await tenantA.query(
        `INSERT INTO whatsapp_connections (status, phone_external_id, configured, authorized) VALUES ('connected', 'a@s.whatsapp.net', true, true)`,
      );
      await tenantB.query(
        `INSERT INTO whatsapp_connections (status, phone_external_id, configured, authorized) VALUES ('connected', 'b@s.whatsapp.net', true, true)`,
      );
      await expect(
        tenantA.query(
          `INSERT INTO whatsapp_connections (status) VALUES ('pairing')`,
        ),
      ).rejects.toMatchObject({ code: '23505' });

      await tenantA.query(
        `UPDATE whatsapp_connections SET status = 'suspended', service_enabled = false, suspension_reason = 'delinquency' WHERE singleton_key = 'default'`,
      );
      const [a, b] = await Promise.all([
        tenantA.query<{ status: string; phone_external_id: string }>(
          `SELECT status, phone_external_id FROM whatsapp_connections`,
        ),
        tenantB.query<{ status: string; phone_external_id: string }>(
          `SELECT status, phone_external_id FROM whatsapp_connections`,
        ),
      ]);
      expect(a.rows[0]).toMatchObject({
        status: 'suspended',
        phone_external_id: 'a@s.whatsapp.net',
      });
      expect(b.rows[0]).toMatchObject({
        status: 'connected',
        phone_external_id: 'b@s.whatsapp.net',
      });
    } finally {
      await tenantA.end();
      await tenantB.end();
    }
  });

  it('rejects invalid provider and connection state at the database boundary', async () => {
    const tenant = new Pool({ connectionString: databaseUrl(databaseA) });
    try {
      await expect(
        tenant.query(`UPDATE whatsapp_connections SET provider = 'untrusted'`),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        tenant.query(`UPDATE whatsapp_connections SET status = 'deleted'`),
      ).rejects.toMatchObject({ code: '23514' });
    } finally {
      await tenant.end();
    }
  });
});
