import type {AvailableModule} from "./module-catalog.js";
import {AccessDeniedError} from "./contracts.js";

/** Control Plane state. Not OIDC/FGA authorization or installer proof. */
export type ModuleEntitlementState = "granted" | "suspended" | "revoked";
export type ModuleInstallState = "requested" | "installed" | "enabled" | "suspended" | "retired";
export interface ModuleLifecycleRow {
  readonly moduleId: string;
  readonly entitlementState: ModuleEntitlementState;
  /** Evaluated against Control PostgreSQL clock, never browser-provided time. */
  readonly entitlementCurrent: boolean;
  readonly installState: ModuleInstallState | null;
  readonly targetVersion: string | null;
  readonly installedVersion: string | null;
  /** Metadata only: AK-30 must verify this against its separate SQL ledger. */
  readonly hasVerificationMetadata: boolean;
}
export interface TenantModuleState {
  readonly moduleId: string;
  readonly version: string;
  readonly schema: string;
  readonly dependencies: readonly string[];
  readonly entitlementState: ModuleEntitlementState | null;
  readonly entitled: boolean;
  readonly installState: ModuleInstallState | null;
  readonly targetVersion: string | null;
  readonly installedVersion: string | null;
  readonly hasVerificationMetadata: boolean;
}
export interface TenantModuleLifecyclePort {
  /** For trusted callers only, AFTER tenant membership. Not a grant. */
  listModuleStates(tenantId:string):Promise<readonly TenantModuleState[]>;
}

/** Represent independent states without collapsing them into a permissive
 * "active" flag. No ModuleAccessPort is derived from this projection.
 */
export function projectTenantModuleStates(
  available: readonly AvailableModule[], rows: readonly ModuleLifecycleRow[],
): readonly TenantModuleState[] {
  const byId = new Map<string,ModuleLifecycleRow>();
  for (const row of rows) {
    if (!row || !/^[a-z][a-z0-9_]*$/.test(row.moduleId) ||
        !["granted","suspended","revoked"].includes(row.entitlementState) ||
        typeof row.entitlementCurrent !== "boolean" ||
        (row.installState !== null &&
         !["requested","installed","enabled","suspended","retired"].includes(row.installState)) ||
        typeof row.hasVerificationMetadata !== "boolean" ||
        byId.has(row.moduleId)) throw new AccessDeniedError();
    byId.set(row.moduleId,row);
  }
  for (const id of byId.keys()) {
    // An entitlement without a matching trusted available build must not
    // show as effective entitlement for an unavailable module.
    if (!available.some(module=>module.id===id)) throw new AccessDeniedError();
  }
  return Object.freeze(available.map(module=>{
    const entry=byId.get(module.id);
    const entitled=entry?.entitlementState==="granted" && entry.entitlementCurrent===true;
    const receipt=entry?.hasVerificationMetadata===true &&
      entry.installedVersion===module.version;
    return Object.freeze({
      moduleId:module.id,version:module.version,schema:module.schema,
      dependencies:module.dependencies,
      entitlementState:entry?.entitlementState??null,
      entitled,
      installState:entry?.installState??null,
      targetVersion:entry?.targetVersion??null,
      installedVersion:entry?.installedVersion??null,
      // This is NOT proof that installer ledger exists or permission to execute.
      hasVerificationMetadata:receipt,
    });
  }));
}
