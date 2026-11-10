import type {Pool} from "pg";
import {
  AccessDeniedError, resolveApprovedModules,
  type AvailableModule, type ModuleCatalogPort, type ModuleDefinition,
} from "@syndes/core-kernel";
import {tenantUUID} from "./adapters.js";

type CatalogRow = {
  module_id: string;
  version: string;
  schema_name: string;
  dependency_id: string | null;
};

/** Read-only Control DB adapter. Trusted module set comes from installed build.
 * This is a catalog, NOT the enabled/entitled/installed gate (AK-10.03/04).
 */
export class PgModuleCatalog implements ModuleCatalogPort {
  constructor(
    private readonly db:Pick<Pool, "query">,
    private readonly trusted:readonly ModuleDefinition[],
  ) {}

  async listAvailableForTenant(tenantId:string):Promise<readonly AvailableModule[]> {
    if (!tenantUUID(tenantId)) throw new AccessDeniedError();
    const sql=[
      "SELECT c.module_id, v.version, c.schema_name, d.dependency_id",
      "FROM public.tenant_registry AS t",
      "JOIN public.module_catalog AS c ON TRUE",
      "JOIN public.module_catalog_versions AS v ON v.module_id=c.module_id AND v.approved=TRUE",
      "LEFT JOIN public.module_catalog_dependencies AS d",
      "ON d.module_id=v.module_id AND d.version=v.version",
      "WHERE t.tenant_id=$1::uuid AND t.state='active'",
      "ORDER BY c.module_id, v.version, d.dependency_id",
    ].join(" ");
    // An unknown/suspended tenant yields no rows; the caller must not
    // interpret availability as membership, install or module permission.
    const result=await this.db.query<CatalogRow>(sql,[tenantId]);
    return resolveApprovedModules(this.trusted,result.rows.map(row=>({
      moduleId:row.module_id,version:row.version,
      schema:row.schema_name,dependencyId:row.dependency_id,
    })));
  }
}
