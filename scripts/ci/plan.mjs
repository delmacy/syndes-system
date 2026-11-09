import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export const catalog = [
  { suite: 'kernel', marker: 'packages/core-kernel/package-lock.json', node: '22' },
  { suite: 'organizations', marker: 'modules/organizations/package-lock.json', node: '22' },
  { suite: 'crm', marker: 'modules/core-crm/package-lock.json', node: '22' },
  { suite: 'inbox', marker: 'modules/inbox/package-lock.json', node: '22' },
  { suite: 'whatsapp-ts', marker: 'modules/whatsapp/package-lock.json', node: '22' },
  { suite: 'whatsapp-go', marker: 'modules/whatsapp/gateway/whatsmeow/go.mod', node: 'go' },
  { suite: 'host', marker: 'apps/core-host/package-lock.json', node: '22' },
  { suite: 'workspace', marker: 'apps/workspace-web/package-lock.json', node: '24' },
  { suite: 'support', marker: 'modules/support/package-lock.json', node: '22' },
  { suite: 'support-web', marker: 'apps/support-web/package-lock.json', node: '24' },
  { suite: 'platform-api', marker: 'apps/master-admin-api/package-lock.json', node: '22' },
  { suite: 'platform-web', marker: 'apps/master-admin-web/package-lock.json', node: '24' },
  { suite: 'infra', marker: 'infra/.env.ci', node: '22' },
];

const all = catalog.map((item) => item.suite);
const add = (target, ...names) => names.forEach((name) => target.add(name));

export function selectSuites(changedPaths, available = all, mode = 'impact') {
  if (!['impact', 'full'].includes(mode)) throw new Error('Unknown CI mode');
  const present = new Set(available);
  const affected = new Set();
  if (mode === 'full') add(affected, ...all);
  for (const rawPath of changedPaths) {
    const file = rawPath.replaceAll('\\', '/');
    if (!file || mode === 'full') continue;

    // Changes to the CI itself and shared security/data boundaries require full regression.
    if (/^(\.github\/|scripts\/ci\/|tests\/integrity\/)/.test(file) ||
        /^(packages\/core-kernel\/|modules\/organizations\/|infra\/|tests\/platform\/)/.test(file) ||
        /^(apps\/core-host\/src\/|apps\/core-host\/test\/)/.test(file)) {
      add(affected, ...all);
    } else if (file.startsWith('modules/core-crm/')) {
      add(affected, 'crm', 'inbox', 'host', 'workspace', 'support');
    } else if (file.startsWith('modules/inbox/')) {
      add(affected, 'inbox', 'whatsapp-ts', 'host', 'workspace', 'support');
    } else if (file.startsWith('modules/whatsapp/')) {
      add(affected, 'whatsapp-ts', 'inbox', 'host', 'workspace');
      if (file.startsWith('modules/whatsapp/gateway/whatsmeow/')) add(affected, 'whatsapp-go');
    } else if (file.startsWith('modules/support/')) {
      add(affected, 'support', 'host', 'support-web');
    } else if (file.startsWith('apps/core-host/')) {
      add(affected, ...all);
    } else if (file.startsWith('apps/workspace-web/')) {
      add(affected, 'workspace');
    } else if (file.startsWith('apps/support-web/')) {
      add(affected, 'support-web', 'support', 'host');
    } else if (file.startsWith('apps/master-admin-api/') ||
               file.startsWith('apps/master-admin-web/')) {
      add(affected, 'platform-api', 'platform-web', 'infra');
    } else if (file.startsWith('docs/') || file === 'README.md') {
      // Documentation-only diffs still execute the always-on governance gate.
    } else {
      // Unknown files or new components never silently bypass validation.
      add(affected, ...all);
    }
  }
  return catalog
    .filter((entry) => affected.has(entry.suite) && present.has(entry.suite))
    .map(({ suite, node }) => ({ suite, node }));
}

export function installedSuites(base = root) {
  return catalog.filter(({ marker }) => existsSync(resolve(base, marker))).map(({ suite }) => suite);
}

function main() {
  const [mode = 'impact', changedFile] = process.argv.slice(2);
  if (mode === 'impact' && !changedFile) {
    throw new Error('Impact mode requires a newline-delimited changed-files path');
  }
  const changed = changedFile ? readFileSync(changedFile, 'utf8').split(/\r?\n/).filter(Boolean) : [];
  const selected = selectSuites(changed, installedSuites(), mode);
  // A nonempty matrix is needed: governance runs separately even for documentation-only PRs.
  process.stdout.write(JSON.stringify({
    include: selected.length ? selected : [{ suite: 'noop', node: '22' }],
  }) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
