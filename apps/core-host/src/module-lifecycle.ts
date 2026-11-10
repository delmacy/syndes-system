import type {Pool} from "pg";
import {AccessDeniedError,projectTenantModuleStates,
  type ModuleLifecycleRow,type TenantModuleLifecyclePort,type TenantModuleState,
} from "@syndes/core-kernel";
import {tenantUUID} from "./adapters.js";
import {PgModuleCatalog} from "./module-catalog.js";

type PgState = {
  module_id:string;
  entitlement_state:string;
  entitlement_current:boolean;
  install_state:string|null;
  target_version:string|null;
  installed_version:string|null;
  verification_digest:string|null;
  verified_at:Date|null;
};

/** Control DB read-only view of per-tenant module state.
 * Must not be substituted for ModuleAccessPort: SQL installation ledger
 * verification, FGA and Host execution gate are still AK-30/AK-10.04.
 */
export class PgModuleLifecycle implements TenantModuleLifecyclePort {
  constructor(
    private readonly db:Pick<Pool,"query">,
    private readonly catalog:PgModuleCatalog,
  ) {}

  async listModuleStates(tenantId:string):Promise<readonly TenantModuleState[]> {
    if (!tenantUUID(tenantId)) throw new AccessDeniedError();
    const available=await this.catalog.listAvailableForTenant(tenantId);
    // Even if the build catalog is empty, never read a tenant database.
    // Re-check tenant active state in this statement.
    const sql=[
      "SELECT e.module_id,e.state AS entitlement_state,",
      "(e.state='granted' AND (e.valid_until IS NULL OR e.valid_until>clock_timestamp())) AS entitlement_current,",
      "i.state AS install_state,i.target_version,i.installed_version,i.verification_digest,i.verified_at",
      "FROM public.tenant_module_entitlements e",
      "JOIN public.tenant_registry t ON t.tenant_id=e.tenant_id AND t.state='active'",
      "LEFT JOIN public.tenant_module_installs i ON i.tenant_id=e.tenant_id AND i.module_id=e.module_id",
      "WHERE e.tenant_id=$1::uuid ORDER BY e.module_id",
    ].join(" ");
    const result=await this.db.query<PgState>(sql,[tenantId]);
    const allowedIds=new Set(available.map(item=>item.id));
    const rows:ModuleLifecycleRow[]=result.rows
      // Unavailable releases remain recorded but cannot be reported as entitled
      // by this build. This includes deapproved/missing dependency modules.
      .filter(row=>allowedIds.has(row.module_id))
      .map(row=>{
        if (typeof row.entitlement_current!=="boolean" ||
            (row.verification_digest!==null && !/^[0-9a-f]{64}$/.test(row.verification_digest))) {
          throw new AccessDeniedError();
        }
        return {
          moduleId:row.module_id,
          entitlementState:row.entitlement_state as ModuleLifecycleRow["entitlementState"],
          entitlementCurrent:row.entitlement_current,
          installState:row.install_state as ModuleLifecycleRow["installState"],
          targetVersion:row.target_version,
          installedVersion:row.installed_version,
          hasVerificationMetadata:!!row.verified_at && !!row.verification_digest,
        };
      });
    return projectTenantModuleStates(available,rows);
  }
}
