const SELECTOR_NAMES = new Set([
  "tenant",
  "tenantid",
  "tenantdatabase",
  "tenantdb",
  "tenantdatabaseid",
  "database",
  "databaseid",
  "databasename",
  "dbname",
]);

export function isTenantSelectorName(name: string): boolean {
  const normalized = name.toLowerCase().replace(/[-_]/g, "");
  return (
    SELECTOR_NAMES.has(normalized) ||
    (normalized.startsWith("x") && SELECTOR_NAMES.has(normalized.slice(1)))
  );
}

export function containsTenantSelector(value: unknown, depth = 0): boolean {
  if (depth > 32) return true;
  if (Array.isArray(value))
    return value.some((entry) => containsTenantSelector(entry, depth + 1));
  if (value === null || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, entry]) =>
      isTenantSelectorName(key) || containsTenantSelector(entry, depth + 1),
  );
}
