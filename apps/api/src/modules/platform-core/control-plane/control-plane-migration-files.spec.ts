import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

describe('Control Plane migration deliverables (CRM-01)', () => {
  const appDir = path.resolve(__dirname, '..', '..', '..', '..');
  const drizzleDir = path.join(appDir, 'drizzle', 'control-plane');
  const metaDir = path.join(drizzleDir, 'meta');
  const scriptsDir = path.join(appDir, 'scripts');

  const journalPath = path.join(metaDir, '_journal.json');

  it('has a PostgreSQL journal with sequential entries', () => {
    expect(existsSync(journalPath)).toBe(true);
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
      version: string | number;
      dialect: string;
      entries: { idx: number; tag: string; when: number }[];
    };
    expect(journal.dialect).toBe('postgresql');
    expect(Number(journal.version)).toBeGreaterThanOrEqual(7);
    journal.entries.forEach((entry, index) => {
      expect(entry.idx).toBe(index);
    });
    expect(journal.entries.length).toBeGreaterThan(0);
  });

  it('binds every journal entry to a checked-in SQL file whose tag matches its timestamp', () => {
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
      entries: { tag: string; when: number }[];
    };
    for (const entry of journal.entries) {
      expect(existsSync(path.join(drizzleDir, `${entry.tag}.sql`))).toBe(true);
      expect(/^\d{14}_/.test(entry.tag)).toBe(true);
      expect(entry.when).toBeGreaterThan(0);
    }
  });

  it('keeps the checked-in SQL DDL-only and free of secrets', () => {
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
      entries: { tag: string }[];
    };
    const forbidden =
      /postgresql:\/\/|password|secret|api[_-]?key|token|credential/i;
    for (const entry of journal.entries) {
      const sql = readFileSync(
        path.join(drizzleDir, `${entry.tag}.sql`),
        'utf8',
      );
      expect(sql).toContain(`"provisioning_state"`);
      expect(sql).toContain(`CREATE TABLE "tenants"`);
      expect(sql).toContain(`UNIQUE("database_name")`);
      expect(/\bINSERT\b|\bUPDATE\b|\bDELETE\b/i.test(sql)).toBe(false);
      expect(forbidden.test(sql)).toBe(false);
    }
  });

  it('ensures the frozen snapshot descriptor exists for every entry', () => {
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
      entries: { tag: string }[];
    };
    expect(existsSync(path.join(metaDir, '_journal.json'))).toBe(true);
    for (const entry of journal.entries) {
      expect(
        existsSync(
          path.join(metaDir, `${entry.tag.split('_')[0]}_snapshot.json`),
        ),
      ).toBe(true);
    }
  });

  it('requires the Control Plane database URL instead of embedding secrets in scripts', () => {
    const apply = readFileSync(
      path.join(scriptsDir, 'apply-control-plane-migrations.mjs'),
      'utf8',
    );
    const verify = readFileSync(
      path.join(scriptsDir, 'verify-control-plane-migrations.mjs'),
      'utf8',
    );
    for (const script of [apply, verify]) {
      expect(script).toContain('CONTROL_PLANE_DATABASE_URL');
      expect(/postgresql:\/\//.test(script)).toBe(false);
      expect(/password\s*=|secret\s*=|api[_-]?key\s*=/i.test(script)).toBe(
        false,
      );
    }
    expect(apply).toContain('drizzle-orm/node-postgres/migrator');
    expect(verify).toContain('tenants_database_name_unique');
  });

  it('aligns package scripts with the registry migration commands', () => {
    const pkg = JSON.parse(
      readFileSync(path.join(appDir, 'package.json'), 'utf8'),
    ) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['cp:migrations:apply']).toBe(
      'node scripts/apply-control-plane-migrations.mjs',
    );
    expect(pkg.scripts['cp:migrations:verify']).toBe(
      'node scripts/verify-control-plane-migrations.mjs',
    );
  });
});
