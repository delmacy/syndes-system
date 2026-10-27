import type { IncomingHttpHeaders } from 'node:http';

const SELECTOR_NAMES = new Set([
  'tenant',
  'tenantid',
  'tenantdatabase',
  'tenantdb',
  'tenantdatabaseid',
  'database',
  'databaseid',
  'databasename',
  'dbname',
]);

export function hasClientTenantSelector(
  headers: IncomingHttpHeaders,
  query: unknown,
  body: unknown,
): boolean {
  if (Object.keys(headers).some((name) => isSelectorName(name))) return true;
  return containsSelector(query) || containsSelector(body);
}

function containsSelector(value: unknown, depth = 0): boolean {
  if (depth > 32) return true;
  if (Array.isArray(value))
    return value.some((entry) => containsSelector(entry, depth + 1));
  if (value === null || typeof value !== 'object') return false;
  return Object.entries(value).some(
    ([key, entry]) => isSelectorName(key) || containsSelector(entry, depth + 1),
  );
}

function isSelectorName(name: string): boolean {
  const normalized = name.toLowerCase().replace(/[-_]/g, '');
  return (
    SELECTOR_NAMES.has(normalized) ||
    (normalized.startsWith('x') && SELECTOR_NAMES.has(normalized.slice(1)))
  );
}
