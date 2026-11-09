import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog, selectSuites } from './plan.mjs';

const available = catalog.map((entry) => entry.suite);
const names = (paths, mode = 'impact', present = available) =>
  selectSuites(paths, present, mode).map((item) => item.suite);

test('documentation-only changes do not create unnecessary module jobs', () => {
  assert.deepEqual(names(['README.md', 'docs/product/MVP-SCOPE.md']), []);
});

test('kernel and tenancy contracts fan out to all available modules', () => {
  assert.deepEqual(names(['packages/core-kernel/src/index.ts']), available);
  assert.deepEqual(names(['modules/organizations/src/index.ts']), available);
});

test('core host security changes require full regression', () => {
  assert.deepEqual(names(['apps/core-host/src/security.ts']), available);
  assert.deepEqual(names(['infra/security-access/compose.yaml']), available);
});

test('WhatsApp provider change reaches Go, TypeScript, host and consumers', () => {
  const impacted = names(['modules/whatsapp/gateway/whatsmeow/gateway.go']);
  for (const suite of ['whatsapp-go', 'whatsapp-ts', 'inbox', 'host', 'workspace']) {
    assert.ok(impacted.includes(suite), suite);
  }
});

test('Support feature change includes both endpoints and frontoffice', () => {
  assert.deepEqual(names(['modules/support/src/index.ts']), ['host', 'support', 'support-web']);
});

test('separate manager UI change includes API and infrastructure boundary', () => {
  assert.deepEqual(names(['apps/master-admin-web/src/App.tsx']), [
    'platform-api', 'platform-web', 'infra',
  ]);
});

test('only available, installed component suites are scheduled', () => {
  assert.deepEqual(names(['modules/support/src/contract.ts'], 'impact', ['support']), ['support']);
});

test('unclassified changes fail safely by selecting all available suites', () => {
  assert.deepEqual(names(['apps/new-module/package.json']), available);
  assert.deepEqual(names(['AGENTS.md']), available);
});

test('full mode ignores paths and executes every available suite', () => {
  assert.deepEqual(names([], 'full'), available);
});

test('unknown CI execution modes fail instead of skipping validation', () => {
  assert.throws(() => names([], 'unchecked'), /Unknown CI mode/);
});
