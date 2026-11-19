/** UC-SIGNUP-01C: trusted first-tenant SQL operator adapter.
 * This is NOT a Core Host provider: the runtime TenantPgProvider rejects
 * state=provisioned. A separate installer owns DB creation and migrations.
 * No DSN, password, role name or tenant ID is taken from a browser.
 */
import {AccessDeniedError,PINNED_TENANT_TRANSACTION,
 type TrustedTenantTransactionProvider} from "@syndes/core-kernel";
import type {Pool} from "pg";
import type {SignupReservation} from "./signup-control-intents.js";
import type {FirstTenantInstallPort} from "./signup-first-tenant-saga.js";

type Provisioner=Readonly<{
 /** Existing operator-only provision-tenant.sh plus fixed reviewed migrations. */
 ensure(intent:SignupReservation):Promise<void>;
 /** Must check actual DB and approved tenant foundation, not a fixture flag. */
 verify(intent:SignupReservation):Promise<boolean>;
}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function expected(intent:SignupReservation){
 if(!intent||![intent.tenantId,intent.organizationId,intent.workspaceId,
  intent.founderId].every(v=>UUID.test(v)))throw new AccessDeniedError();
 const suffix=intent.tenantId.replaceAll("-","").toLowerCase();
 return {name:"syndes_tenant_"+suffix,role:"syndes_t_"+suffix};
}
export class PgFirstTenantOperatorInstaller implements FirstTenantInstallPort{
 constructor(private readonly control:Pick<Pool,"query">,
  private readonly tenants:TrustedTenantTransactionProvider,
  private readonly provisioner:Provisioner){}
 async ensureDatabase(intent:SignupReservation):Promise<void>{
  const target=expected(intent);
  await this.provisioner.ensure(intent);
  // NO UPDATE on conflict: an existing revoked founder remains revoked.
  // The installer DB role must have the narrowly approved tenant membership
  // privileges; the normal syndes_core runtime must not.
  await this.control.query(`
   INSERT INTO public.tenant_memberships(tenant_id,principal_id,state)
   SELECT t.tenant_id,$2,'active' FROM public.tenant_registry t
   WHERE t.tenant_id=$1::uuid AND t.database_name=$3 AND t.role_name=$4
     AND t.state='provisioned'
     AND NOT EXISTS(SELECT 1 FROM public.tenant_memberships m
        WHERE m.tenant_id=t.tenant_id AND m.principal_id<>$2)
   ON CONFLICT(tenant_id,principal_id) DO NOTHING
  `,[intent.tenantId,intent.founderId,target.name,target.role]);
  if(!await this.verifyDatabase(intent))throw new AccessDeniedError();
 }
 async verifyDatabase(intent:SignupReservation):Promise<boolean>{
  const target=expected(intent);
  const rows=await this.control.query(`
   SELECT t.tenant_id FROM public.tenant_registry t
   JOIN public.tenant_memberships m ON m.tenant_id=t.tenant_id
      AND m.principal_id=$2 AND m.state='active'
   WHERE t.tenant_id=$1::uuid
    AND t.database_name=$3 AND t.role_name=$4
    AND t.state IN ('provisioned','active')
    AND NOT EXISTS(SELECT 1 FROM public.tenant_memberships x
     WHERE x.tenant_id=t.tenant_id AND x.principal_id<>$2)
   LIMIT 2
  `,[intent.tenantId,intent.founderId,target.name,target.role]);
  return rows.rows.length===1&&await this.provisioner.verify(intent)===true;
 }
 async ensureDefaultContext(intent:SignupReservation):Promise<void>{
  expected(intent);
  await this.tenants.withTransaction(intent.tenantId,async tx=>{
   if(tx.tenantId!==intent.tenantId||
     tx[PINNED_TENANT_TRANSACTION]!==true)throw new AccessDeniedError();
   // CTE performs exactly one first-context bootstrap, with audit in same
   // transaction. A retry with any partial context does NOT invent grants.
   await tx.query(`
    WITH eligible AS (
      SELECT $1::uuid AS tenant_id
      WHERE NOT EXISTS (SELECT 1 FROM public.platform_organizations
         WHERE tenant_id=$1::uuid)
        AND (SELECT count(*)::int FROM pg_indexes
          WHERE schemaname='public' AND indexname IN(
           'platform_legacy_single_organization',
           'platform_legacy_single_workspace'))=2
    ), org AS (
     INSERT INTO public.platform_organizations(
      tenant_id,id,display_name,is_default)
     SELECT tenant_id,$2::uuid,$5,true FROM eligible RETURNING tenant_id,id
    ), ws AS (
     INSERT INTO public.platform_workspaces(
       tenant_id,id,organization_id,name,slug,is_default)
     SELECT tenant_id,$3::uuid,id,$6,'principal',true FROM org
     RETURNING tenant_id,id,organization_id
    ), om AS (
     INSERT INTO public.platform_org_memberships(
      tenant_id,organization_id,principal_id,role)
     SELECT tenant_id,id,$4,'admin' FROM org RETURNING tenant_id,organization_id
    ), wm AS (
     INSERT INTO public.platform_workspace_memberships(
      tenant_id,organization_id,workspace_id,principal_id,role)
     SELECT w.tenant_id,w.organization_id,w.id,$4,'admin'
     FROM ws w JOIN om m ON m.tenant_id=w.tenant_id
       AND m.organization_id=w.organization_id RETURNING workspace_id
    )
    INSERT INTO public.platform_org_audit(
     tenant_id,organization_id,actor_id,event,entity_id)
    SELECT o.tenant_id,o.id,$4,'default_context_initialized',o.id
    FROM org o JOIN wm w ON w.workspace_id=$3::uuid
   `,[intent.tenantId,intent.organizationId,intent.workspaceId,
    intent.founderId,intent.organizationName,intent.workspaceName]);
  });
  if(!await this.verifyDefaultContext(intent))throw new AccessDeniedError();
 }
 async verifyDefaultContext(intent:SignupReservation):Promise<boolean>{
  expected(intent);
  const db=await this.tenants.resolve(intent.tenantId);
  if(db.tenantId!==intent.tenantId)throw new AccessDeniedError();
  const rows=await db.query(`
   SELECT o.id FROM public.platform_organizations o
   JOIN public.platform_workspaces w ON w.tenant_id=o.tenant_id
    AND w.organization_id=o.id AND w.id=$3::uuid AND w.is_default
    AND w.status='active' AND w.name=$6
   JOIN public.platform_org_memberships om ON om.tenant_id=o.tenant_id
    AND om.organization_id=o.id AND om.principal_id=$4
    AND om.role='admin' AND om.state='active'
   JOIN public.platform_workspace_memberships wm ON wm.tenant_id=w.tenant_id
    AND wm.organization_id=w.organization_id AND wm.workspace_id=w.id
    AND wm.principal_id=$4 AND wm.role='admin' AND wm.state='active'
   WHERE o.tenant_id=$1::uuid AND o.id=$2::uuid
    AND o.is_default AND o.status='active' AND o.display_name=$5
    AND (SELECT count(*)::int FROM public.platform_organizations
      WHERE tenant_id=$1::uuid)=1
    AND (SELECT count(*)::int FROM public.platform_workspaces
      WHERE tenant_id=$1::uuid)=1
    AND (SELECT count(*)::int FROM pg_indexes WHERE schemaname='public'
      AND indexname IN('platform_legacy_single_organization',
                       'platform_legacy_single_workspace'))=2
    AND EXISTS(SELECT 1 FROM public.platform_org_audit a
      WHERE a.tenant_id=o.tenant_id AND a.organization_id=o.id
      AND a.entity_id=o.id AND a.actor_id=$4
      AND a.event='default_context_initialized')
   LIMIT 2
  `,[intent.tenantId,intent.organizationId,intent.workspaceId,
   intent.founderId,intent.organizationName,intent.workspaceName]);
  return rows.rows.length===1;
 }
 async verifyActive(intent:SignupReservation):Promise<boolean>{
  const target=expected(intent);
  const rows=await this.control.query(`
   SELECT t.tenant_id FROM public.tenant_registry t
   JOIN public.tenant_memberships m ON m.tenant_id=t.tenant_id
    AND m.principal_id=$2 AND m.state='active'
   WHERE t.tenant_id=$1::uuid AND t.state='active'
     AND t.database_name=$3 AND t.role_name=$4
   LIMIT 2
  `,[intent.tenantId,intent.founderId,target.name,target.role]);
  return rows.rows.length===1;
 }
}
