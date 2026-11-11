import { AccessDeniedError } from "./contracts.js";
import { ModuleRegistry, type ModuleDefinition } from "./module-registry.js";

/** Catalog approval is not tenant entitlement, installation or FGA permission. */
export interface CatalogApprovalRow {
  readonly moduleId: string;
  readonly version: string;
  readonly schema: string;
  readonly dependencyId: string | null;
}
export interface AvailableModule {
  readonly id: string;
  readonly version: string;
  readonly schema: string;
  readonly dependencies: readonly string[];
}
export interface ModuleCatalogPort {
  listAvailableForTenant(tenantId: string): Promise<readonly AvailableModule[]>;
}

/** Only already-approved, trusted build manifests can become available.
 * Mismatched schema/dependencies fail closed. Other versions and modules
 * may be present in Control DB but never become executable in this build.
 */
export function resolveApprovedModules(
  buildDefinitions: readonly ModuleDefinition[],
  rows: readonly CatalogApprovalRow[],
): readonly AvailableModule[] {
  const ordered = new ModuleRegistry(buildDefinitions).ordered();
  const build = new Map(ordered.map(def => [def.id, def]));
  const candidates = new Map<string, {definition: ModuleDefinition; dependencies: Set<string>}>();

  for (const row of rows) {
    if (!row || typeof row.moduleId !== "string" || typeof row.version !== "string" ||
        typeof row.schema !== "string" ||
        (row.dependencyId !== null && typeof row.dependencyId !== "string")) {
      throw new AccessDeniedError();
    }
    const definition = build.get(row.moduleId);
    if (!definition || definition.version !== row.version) continue;
    if (!definition.schema || definition.schema !== row.schema) throw new AccessDeniedError();
    if (row.dependencyId && !build.has(row.dependencyId)) throw new AccessDeniedError();
    const entry = candidates.get(row.moduleId) ??
      {definition, dependencies: new Set<string>()};
    if (row.dependencyId) {
      if (entry.dependencies.has(row.dependencyId)) throw new AccessDeniedError();
      entry.dependencies.add(row.dependencyId);
    }
    candidates.set(row.moduleId, entry);
  }

  const declared = new Map<string, AvailableModule>();
  for (const [id, candidate] of candidates) {
    // Platform is the inseparable Kernel/Host substrate, not a tenant module.
    const expected = (candidate.definition.dependencies ?? [])
      .filter(dependency => dependency !== "platform").sort();
    const actual = [...candidate.dependencies].sort();
    if (expected.length !== actual.length ||
        expected.some((value, index) => value !== actual[index])) {
      throw new AccessDeniedError();
    }
    declared.set(id, Object.freeze({
      id, version: candidate.definition.version, schema: candidate.definition.schema!,
      dependencies: Object.freeze([...expected]),
    }));
  }

  const available = new Set<string>();
  for (const definition of ordered) {
    const entry = declared.get(definition.id);
    if (entry && entry.dependencies.every(dependency => available.has(dependency))) {
      available.add(definition.id);
    }
  }
  return Object.freeze([...available].sort().map(id => declared.get(id)!));
}
