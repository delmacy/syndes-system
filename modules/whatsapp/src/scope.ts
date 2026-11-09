import {AccessDeniedError,type Actor,type CoreKernel,type TrustedTenantDatabaseProvider} from "@syndes/core-kernel";

export type WhatsAppScope=Readonly<{tenantId:string;organizationId:string;workspaceId:string}>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validScope(scope:WhatsAppScope):WhatsAppScope{
 if(!uuid.test(scope.tenantId)||!uuid.test(scope.organizationId)||!uuid.test(scope.workspaceId))
  throw Error("Invalid trusted WhatsApp scope");
 return scope;
}
/** Default context ONLY while 002 blocks other organizations/workspaces.
 * Never accept organization IDs from a request body or path.
 */
export class WhatsAppDefaultContextGuard{
 constructor(private readonly kernel:CoreKernel,private readonly databases:TrustedTenantDatabaseProvider){}
 async resolve(tenantId:string,actor:Actor):Promise<WhatsAppScope>{
  return this.kernel.execute({actor,tenantId,action:"read",resource:"whatsapp:accounts"},async()=>{
   const db=await this.databases.resolve(tenantId);
   if(db.tenantId!==tenantId)throw Error("Tenant database mismatch");
   const query=await db.query(`
    SELECT o.id AS organization_id,w.id AS workspace_id
    FROM platform_organizations o
    JOIN platform_org_memberships om
      ON om.tenant_id=o.tenant_id AND om.organization_id=o.id
    JOIN platform_workspaces w
      ON w.tenant_id=o.tenant_id AND w.organization_id=o.id
    JOIN platform_workspace_memberships wm
      ON wm.tenant_id=w.tenant_id AND wm.organization_id=w.organization_id
        AND wm.workspace_id=w.id AND wm.principal_id=om.principal_id
    WHERE o.tenant_id=$1::uuid AND om.principal_id=$2
      AND o.is_default AND w.is_default
      AND o.status='active' AND w.status='active'
      AND om.state='active' AND wm.state='active'
      AND EXISTS(SELECT 1 FROM platform_legacy_backfill_runs audit
        WHERE audit.tenant_id=o.tenant_id AND audit.organization_id=o.id)
      AND EXISTS(SELECT 1 FROM pg_indexes
        WHERE schemaname=current_schema() AND indexname='platform_legacy_single_organization')
      AND EXISTS(SELECT 1 FROM pg_indexes
        WHERE schemaname=current_schema() AND indexname='platform_legacy_single_workspace')
    LIMIT 1`,[tenantId,actor.id]);
   const row=query.rows[0];
   if(!row)throw new AccessDeniedError();
   return validScope({tenantId,organizationId:String(row.organization_id),workspaceId:String(row.workspace_id)});
  });
 }
}


/** Reusable scoped SQL helper. All interpolated fragments originate in
 * server source, while the IDs remain bind parameters. Legacy direct callers
 * without a scope remain single-context only under migration 002.
 */
export function whatsappScopedQuery(
 db:{query(sql:string,values:readonly unknown[]):Promise<{rows:Record<string,unknown>[]}>},
 scope:WhatsAppScope|undefined,sql:string,values:readonly unknown[]
):Promise<{rows:Record<string,unknown>[]}>{
 if(scope)validScope(scope);
 let markers=0,org=false,ws=false;
 const q=sql.replace(/\/\*WSCOPE:([\s\S]*?)\*\//g,(_whole,fragment:string)=>{
  markers++;
  if(fragment.includes("@@ORG@@"))org=true;
  if(fragment.includes("@@WS@@"))ws=true;
  return scope?fragment.replaceAll("@@ORG@@","$"+(values.length+1)+"::uuid")
    .replaceAll("@@WS@@","$"+(values.length+2)+"::uuid"):"";
 });
 if(scope&&(!markers||!org||!ws))throw Error("WhatsApp scoped SQL lacks organization/workspace predicates");
 return db.query(q,scope?[...values,scope.organizationId,scope.workspaceId]:values);
}
