import path from 'node:path';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const CLI_TEST_TIMEOUT_MS = 30000;

describe('Control Plane migration verifier (CRM-01)', () => {
  const scriptPath = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'scripts',
    'verify-control-plane-migrations.mjs',
  );
  const source = readFileSync(scriptPath, 'utf8');

  describe('structural invariants', () => {
    it('activates CLI mode only when this exact file is the invoked entrypoint', () => {
      expect(source).toContain('if (!process.argv[1])');
      expect(source).toContain('return false;');
      expect(source).toContain('invokedHref === import.meta.url');
      expect(source).toContain(
        'invokedHref.toLowerCase() === import.meta.url.toLowerCase()',
      );
      expect(source).toContain('if (isInvokedEntrypoint())');
      expect(source.indexOf('if (isInvokedEntrypoint())')).toBeGreaterThan(
        source.indexOf('export function makeProbeDatabaseName'),
      );
      expect(source).toContain('new pg.Pool({ connectionString })');
    });

    it('keeps the missing-credential exit path after the CLI guard', () => {
      const guardIndex = source.indexOf('if (isInvokedEntrypoint())');
      const exitIndex = source.indexOf('process.exit(1)');
      expect(guardIndex).toBeGreaterThan(-1);
      expect(exitIndex).toBeGreaterThan(guardIndex);
    });

    it('normalizes both sides of the tenant columns comparison', () => {
      expect(source).toContain('columnsMatchExpected(before.columns)');
      expect(source).toContain(
        'JSON.stringify(normalizeOrderedSet(EXPECTED_TENANT_COLUMNS))',
      );
      expect(source).toContain('JSON.stringify(normalizeOrderedSet(actual))');
    });

    it('never destructively mutates rows outside its rollback transaction', () => {
      expect(source).not.toContain('DELETE FROM');
      expect(source).not.toContain('UPDATE ');
      expect(source).not.toMatch(/INSERT INTO[\s\S]*\bCOMMIT\b/);
      const beginIndex = source.indexOf("await client.query('BEGIN')");
      const probeIndex = source.indexOf('INSERT INTO tenants');
      const rollbackIndex = source.indexOf("await client.query('ROLLBACK')");
      const releaseIndex = source.indexOf('client.release()');
      expect(beginIndex).toBeGreaterThan(-1);
      expect(probeIndex).toBeGreaterThan(beginIndex);
      expect(rollbackIndex).toBeGreaterThan(probeIndex);
      expect(releaseIndex).toBeGreaterThan(rollbackIndex);
    });

    it('builds a unique probe database name and parameterizes the probe insert', () => {
      expect(source).toContain('probe_migration_verification_');
      expect(source).toContain('randomUUID()');
      expect(source).not.toMatch(/'probe_migration_verification'/);
      expect(source).toContain('VALUES ($1, $2)');
      expect(source).toContain(
        "['Migration verification probe', probeDatabaseName]",
      );
    });
  });

  describe('executable provider behavior (Node child bridging ESM)', () => {
    const fileUrl = pathToFileURL(scriptPath).href;

    function environmentWithoutDatabaseUrl() {
      const childEnvironment = { ...process.env };
      delete childEnvironment.CONTROL_PLANE_DATABASE_URL;
      return childEnvironment;
    }

    /**
     * Runs in a dedicated Node ESM child process. It imports the verifier
     * module without CONTROL_PLANE_DATABASE_URL and must therefore never
     * reach the database access guarded by the CLI entrypoint check; if the
     * guard regresses, the child exits 1 with the required-credential
     * message instead of the exported probe JSON below.
     */
    const importProbeProgram = [
      `import assert from 'node:assert/strict';`,
      `import { columnsMatchExpected, isInvokedEntrypoint, makeProbeDatabaseName, normalizeOrderedSet } from ${JSON.stringify(
        fileUrl,
      )};`,
      `const probeNames = [makeProbeDatabaseName(), makeProbeDatabaseName()];`,
      `assert.notEqual(probeNames[0], probeNames[1]);`,
      `for (const name of probeNames) {`,
      `  assert.match(name, /^probe_migration_verification_[0-9a-f]{32}$/);`,
      `}`,
      `assert.deepEqual(normalizeOrderedSet([' Created_at ', 'DATABASE_name', 'id']), ['created_at', 'database_name', 'id']);`,
      `const orderedColumns = columnsMatchExpected([`,
      `  'created_at', 'updated_at', 'id', 'display_name', 'database_name', 'provisioning_state',`,
      `]);`,
      `assert.equal(orderedColumns, true, 'valid columns in arbitrary order must pass');`,
      `assert.equal(columnsMatchExpected([`,
      `  'id', 'display_name', 'database_name', 'provisioning_state', 'created_at', 'updated_at', 'password_hash',`,
      `]), false, 'extra credential-shaped column must fail');`,
      `assert.equal(columnsMatchExpected([`,
      `  'id', 'display_name', 'database_name', 'provisioning_state', 'created_at',`,
      `]), false, 'missing column must fail');`,
      `console.log(JSON.stringify({`,
      `  isInvokedEntrypoint: isInvokedEntrypoint(),`,
      `  exportedHelpers: [columnsMatchExpected, isInvokedEntrypoint, makeProbeDatabaseName, normalizeOrderedSet].map((exported) => typeof exported),`,
      `}));`,
    ].join('\n');

    it(
      'imports without database side effects when no database URL is configured',
      () => {
        const probe = spawnSync(
          process.execPath,
          ['--input-type=module', '-e', importProbeProgram],
          { encoding: 'utf8', env: environmentWithoutDatabaseUrl() },
        );
        expect(probe.stderr).not.toMatch(
          /CONTROL_PLANE_DATABASE_URL is required/,
        );
        expect(probe.status).toBe(0);
        const probeResult = JSON.parse(probe.stdout) as {
          isInvokedEntrypoint: unknown;
          exportedHelpers: unknown[];
        };
        expect(probeResult.isInvokedEntrypoint).toBe(false);
        expect(Array.isArray(probeResult.exportedHelpers)).toBe(true);
        for (const helperType of probeResult.exportedHelpers) {
          expect(helperType).toBe('function');
        }
      },
      CLI_TEST_TIMEOUT_MS,
    );

    it(
      'executes as CLI when the script file is the entrypoint and fails closed without credentials',
      () => {
        const probe = spawnSync(process.execPath, [scriptPath], {
          encoding: 'utf8',
          env: environmentWithoutDatabaseUrl(),
        });
        expect(probe.status).toBe(1);
        expect(`${probe.stdout}${probe.stderr}`).toMatch(
          /CONTROL_PLANE_DATABASE_URL is required/,
        );
      },
      CLI_TEST_TIMEOUT_MS,
    );
  });
});
