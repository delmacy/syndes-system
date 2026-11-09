import {AccessDeniedError,type Actor,type TenantDatabase} from "./contracts.js";

/** A requested scope is NEVER trusted. It is useful only as a lookup key
 * constrained by authenticated principal membership in the tenant DB.
 */
export type RequestedOperationalScope=Readonly<{organizationId?:unknown;workspaceId?:unknown}>;
export type AuthorizedOperationalScope=Readonly<{
 organizationId:string;workspaceId:string;scopeWriteAllowed:boolean;
}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Fail closed if any scope header is missing or malformed. Never use
 * request data as a SQL identifier or organization owner directly. */
export async function resolveSelectedOperationalScope(
 db:TenantDatabase,tenantId:string,actor:Actor,selection:RequestedOperationalScope,enabled:boolean
):Promise<AuthorizedOperationalScope>{
 const org=selection.organizationId,ws=selection.workspaceId;
 if(typeof org!=="string"||typeof ws!=="string"||!UUID.test(org)||!UUID.test(ws))
  throw new AccessDeniedError();
 if(db.tenantId!==tenantId)throw new AccessDeniedError();
 // When migration 002 indexes exist, only the default context can be
 // selected. Without them, the explicit SERVER flag is required.
 // A missing/half-removed 002 guard fails closed in both modes.
 if(typeof enabled!=="boolean")throw new AccessDeniedError();
 const rows=await db.query(`
   SELECT o.id AS organization_id,w.id AS workspace_id,
     (om.role IN ('admin','editor') AND wm.role IN ('admin','editor')) AS scope_write_allowed
   FROM platform_organizations o
   JOIN platform_org_memberships om ON om.tenant_id=o.tenant_id
     AND om.organization_id=o.id AND om.principal_id=$2 AND om.state='active'
   JOIN platform_workspaces w ON w.tenant_id=o.tenant_id
     AND w.organization_id=o.id AND w.status='active'
   JOIN platform_workspace_memberships wm ON wm.tenant_id=w.tenant_id
     AND wm.organization_id=w.organization_id AND wm.workspace_id=w.id
     AND wm.principal_id=$2 AND wm.state='active'
   WHERE o.tenant_id=$1::uuid AND o.status='active'
     AND o.id=$3::uuid AND w.id=$4::uuid
     AND EXISTS(
       SELECT 1 FROM platform_legacy_backfill_runs audit
       WHERE audit.tenant_id=o.tenant_id
         AND EXISTS(SELECT 1 FROM platform_organizations def
           WHERE def.tenant_id=audit.tenant_id AND def.id=audit.organization_id
             AND def.is_default)
     )
     AND (
       (
         EXISTS(SELECT 1 FROM pg_indexes
           WHERE schemaname=current_schema() AND indexname='platform_legacy_single_organization')
         AND EXISTS(SELECT 1 FROM pg_indexes
           WHERE schemaname=current_schema() AND indexname='platform_legacy_single_workspace')
         AND o.is_default AND w.is_default
       )
       OR
       (
         $5::boolean
         AND NOT EXISTS(SELECT 1 FROM pg_indexes
           WHERE schemaname=current_schema() AND indexname='platform_legacy_single_organization')
         AND NOT EXISTS(SELECT 1 FROM pg_indexes
           WHERE schemaname=current_schema() AND indexname='platform_legacy_single_workspace')
       )
     ) LIMIT 1
 `,[tenantId,actor.id,org,ws,enabled]);
 const r=rows.rows[0];
 if(!r)throw new AccessDeniedError();
 return {organizationId:String(r.organization_id),workspaceId:String(r.workspace_id),
  scopeWriteAllowed:r.scope_write_allowed===true};
}
