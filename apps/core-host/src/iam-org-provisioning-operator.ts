/**
 * Trusted operator-only, resumable Organization provisioning.
 *
 * Tenant database and Control/Keycloak cannot share one SQL transaction.
 * The Control intent is durable BEFORE contacting Keycloak. A deterministic
 * immutable alias allows recovery after a 201 followed by network failure.
 *
 * This is deliberately NOT exposed as Nest HTTP or mounted in main.ts.
 * Normal tenant and Manager API tokens cannot invoke this operator.
 */
import {randomUUID} from "node:crypto";
import {
 AccessDeniedError,PINNED_TENANT_TRANSACTION,
 type TrustedTenantTransactionProvider,
} from "@syndes/core-kernel";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NAME=(value:unknown):value is string=>typeof value==="string"&&
 value.trim().length>=2&&value.trim().length<=160&&
 ![...value].some(c=>c.charCodeAt(0)<32);
type Query={query(sql:string,values:readonly unknown[]):Promise<{
 rows:Record<string,unknown>[];rowCount:number|null;
}>};
export type OrgProvisionInput=Readonly<{
 requestId:string;tenantId:string;founderId:string;
 organizationName:string;workspaceName:string;
}>;
export type OrgProvisionIntent=Readonly<OrgProvisionInput & {
 organizationId:string;workspaceId:string;keycloakAlias:string;
 keycloakOrganizationId:string|null;state:"reserved"|"reconcile_required"|"ready";
 revision:number;
}>;
function checked(input:OrgProvisionInput):OrgProvisionInput{
 if(!input||![input.requestId,input.tenantId,input.founderId].every(x=>
   typeof x==="string"&&UUID.test(x))||
   !NAME(input.organizationName)||!NAME(input.workspaceName))
  throw new AccessDeniedError();
 return Object.freeze({...input,organizationName:input.organizationName.trim(),
  workspaceName:input.workspaceName.trim()});
}
function validIntent(row:Record<string,unknown>):OrgProvisionIntent{
 const revision=Number(row.revision);
 if(![row.request_id,row.tenant_id,row.founder_id,row.organization_id,
      row.workspace_id].every(x=>typeof x==="string"&&UUID.test(x))||
    !NAME(row.organization_name)||!NAME(row.workspace_name)||
    typeof row.keycloak_alias!=="string"||
    !/^syndes-[0-9a-f]{32}-[0-9a-f]{32}$/.test(row.keycloak_alias)||
    !(row.keycloak_organization_id===null||
      typeof row.keycloak_organization_id==="string"&&UUID.test(row.keycloak_organization_id))||
    !["reserved","reconcile_required","ready"].includes(String(row.state))||
    !Number.isSafeInteger(revision)||revision<1)
  throw new AccessDeniedError();
 return Object.freeze({
  requestId:row.request_id as string,tenantId:row.tenant_id as string,
  founderId:row.founder_id as string,
  organizationName:row.organization_name as string,
  workspaceName:row.workspace_name as string,
  organizationId:row.organization_id as string,
  workspaceId:row.workspace_id as string,
  keycloakAlias:row.keycloak_alias as string,
  keycloakOrganizationId:row.keycloak_organization_id as string|null,
  state:row.state as OrgProvisionIntent["state"],revision,
 });
}
export interface OrgProvisionIntentPort{
 reserve(input:OrgProvisionInput):Promise<OrgProvisionIntent>;
 bindKeycloak(requestId:string,keycloakOrganizationId:string):Promise<void>;
 markReady(requestId:string,keycloakOrganizationId:string):Promise<void>;
 markReconcileRequired(requestId:string):Promise<void>;
}
export interface TrustedKeycloakOrgWriter{
 ensureOrganization(alias:string,name:string):Promise<string>;
 ensureMember(organizationId:string,founderId:string):Promise<void>;
 isActiveMember(organizationId:string,founderId:string):Promise<boolean>;
}
export interface TrustedTenantOrgWriter{
 founderIsAdmin(tenantId:string,founderId:string):Promise<boolean>;
 ensure(intent:OrgProvisionIntent):Promise<void>;
 verify(intent:OrgProvisionIntent):Promise<boolean>;
}
export interface TrustedOrgLinkWriter{
 ensure(intent:OrgProvisionIntent,keycloakOrganizationId:string):Promise<void>;
 verify(intent:OrgProvisionIntent,keycloakOrganizationId:string):Promise<boolean>;
}
/** Control operator pool (NOT a syndes_core runtime pool). Caller must set a
 * dedicated NOLOGIN provisioner role, never a caller-selected SQL role. */
export class PgOrgProvisionIntentStore implements OrgProvisionIntentPort{
 constructor(private readonly control:Query){}
 async reserve(raw:OrgProvisionInput):Promise<OrgProvisionIntent>{
  const input=checked(raw),alias="syndes-"+input.tenantId.replaceAll("-","")+
   "-"+input.requestId.replaceAll("-","");
  const created=await this.control.query(`
    WITH permitted AS MATERIALIZED (
      SELECT t.tenant_id FROM public.tenant_registry t
      JOIN public.tenant_memberships m ON m.tenant_id=t.tenant_id
       AND m.principal_id=$3 AND m.state='active'
      WHERE t.tenant_id=$2::uuid AND t.state='active'
    ), inserted AS (
      INSERT INTO public.platform_iam_org_provision_intents(
       request_id,tenant_id,founder_id,organization_id,workspace_id,
       organization_name,workspace_name,keycloak_alias)
      SELECT $1::uuid,tenant_id,$3,$4::uuid,$5::uuid,$6,$7,$8
      FROM permitted
      ON CONFLICT(request_id) DO NOTHING RETURNING request_id,revision
    ), audited AS (
      INSERT INTO public.platform_iam_org_provision_audit(
       request_id,revision,event)
      SELECT request_id,revision,'reserved' FROM inserted
      RETURNING event_id
    )
    SELECT count(*)::int AS n FROM audited
  `,[input.requestId,input.tenantId,input.founderId,randomUUID(),randomUUID(),
      input.organizationName,input.workspaceName,alias]);
  if(!Array.isArray(created.rows))throw new AccessDeniedError();
  const rows=await this.control.query(`
    SELECT i.* FROM public.platform_iam_org_provision_intents i
    JOIN public.tenant_registry t ON t.tenant_id=i.tenant_id AND t.state='active'
    JOIN public.tenant_memberships m ON m.tenant_id=i.tenant_id
      AND m.principal_id=i.founder_id AND m.state='active'
    WHERE i.request_id=$1::uuid AND i.tenant_id=$2::uuid
     AND i.founder_id=$3
  `,[input.requestId,input.tenantId,input.founderId]);
  if(rows.rows.length!==1)throw new AccessDeniedError();
  const intent=validIntent(rows.rows[0]);
  if(intent.organizationName!==input.organizationName||
    intent.workspaceName!==input.workspaceName||intent.keycloakAlias!==alias)
   throw new AccessDeniedError();
  return intent;
 }
 async bindKeycloak(requestId:string,keycloakOrganizationId:string):Promise<void>{
  if(!UUID.test(requestId)||!UUID.test(keycloakOrganizationId))throw new AccessDeniedError();
  const result=await this.control.query(`
    WITH changed AS (
     UPDATE public.platform_iam_org_provision_intents
       SET keycloak_organization_id=$2::uuid,revision=revision+1,
           changed_at=clock_timestamp()
     WHERE request_id=$1::uuid AND state<>'ready'
       AND keycloak_organization_id IS NULL
     RETURNING request_id,revision
    ), audited AS (
     INSERT INTO public.platform_iam_org_provision_audit(
      request_id,revision,event)
     SELECT request_id,revision,'keycloak_linked' FROM changed
     RETURNING event_id
    ) SELECT count(*)::int AS n FROM audited
  `,[requestId,keycloakOrganizationId]);
  if(Number(result.rows[0]?.n)>1)throw new AccessDeniedError();
  const verified=await this.control.query(`
    SELECT keycloak_organization_id::text AS id
    FROM public.platform_iam_org_provision_intents
    WHERE request_id=$1::uuid
  `,[requestId]);
  if(verified.rows.length!==1||
     verified.rows[0].id!==keycloakOrganizationId)throw new AccessDeniedError();
 }
 async markReady(requestId:string,kcId:string):Promise<void>{
  if(!UUID.test(requestId)||!UUID.test(kcId))throw new AccessDeniedError();
  const rows=await this.control.query(`
    WITH changed AS (
      UPDATE public.platform_iam_org_provision_intents
        SET state='ready',revision=revision+1,changed_at=clock_timestamp()
      WHERE request_id=$1::uuid AND keycloak_organization_id=$2::uuid
        AND state<>'ready'
      RETURNING request_id,revision
    ), audited AS (
      INSERT INTO public.platform_iam_org_provision_audit(request_id,revision,event)
      SELECT request_id,revision,'ready' FROM changed RETURNING event_id
    ) SELECT count(*)::int AS n FROM audited
  `,[requestId,kcId]);
  if(Number(rows.rows[0]?.n)>1)throw new AccessDeniedError();
  const check=await this.control.query(`
    SELECT state,keycloak_organization_id::text AS id
    FROM public.platform_iam_org_provision_intents WHERE request_id=$1::uuid
  `,[requestId]);
  if(check.rows.length!==1||check.rows[0].state!=="ready"||
     check.rows[0].id!==kcId)throw new AccessDeniedError();
 }
 async markReconcileRequired(requestId:string):Promise<void>{
  if(!UUID.test(requestId))throw new AccessDeniedError();
  await this.control.query(`
    WITH changed AS (
      UPDATE public.platform_iam_org_provision_intents
       SET state='reconcile_required',revision=revision+1,
           changed_at=clock_timestamp()
      WHERE request_id=$1::uuid AND state='reserved'
      RETURNING request_id,revision
    ) INSERT INTO public.platform_iam_org_provision_audit(
      request_id,revision,event)
      SELECT request_id,revision,'reconcile_required' FROM changed
  `,[requestId]);
 }
}

/** A separately authenticated *tenant installer* PG provider. It cannot be
 * replaced by a Core Host query-only handle or a DSN from an HTTP request.
 * Every step is idempotent; the initial set of four rows commits atomically.
 */
export class PgTenantOrganizationWriter implements TrustedTenantOrgWriter{
 constructor(private readonly tenants:TrustedTenantTransactionProvider){}
 async founderIsAdmin(tenantId:string,founderId:string):Promise<boolean>{
  if(!UUID.test(tenantId)||!UUID.test(founderId))return false;
  const db=await this.tenants.resolve(tenantId);
  if(db.tenantId!==tenantId)throw new AccessDeniedError();
  const result=await db.query(`
    SELECT 1 FROM public.platform_organizations o
    JOIN public.platform_workspaces w ON w.tenant_id=o.tenant_id
     AND w.organization_id=o.id AND w.is_default AND w.status='active'
    JOIN public.platform_org_memberships om ON om.tenant_id=o.tenant_id
     AND om.organization_id=o.id AND om.principal_id=$2
     AND om.state='active' AND om.role='admin'
    JOIN public.platform_workspace_memberships wm ON wm.tenant_id=w.tenant_id
     AND wm.organization_id=w.organization_id AND wm.workspace_id=w.id
     AND wm.principal_id=$2 AND wm.state='active' AND wm.role='admin'
    WHERE o.tenant_id=$1::uuid AND o.is_default AND o.status='active'
      AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
        AND indexname IN('platform_legacy_single_organization',
                         'platform_legacy_single_workspace'))
    LIMIT 1
  `,[tenantId,founderId]);
  return result.rows.length===1;
 }
 async ensure(intent:OrgProvisionIntent):Promise<void>{
  if(!intent||![intent.tenantId,intent.organizationId,
   intent.workspaceId,intent.founderId].every(x=>UUID.test(x)))
   throw new AccessDeniedError();
  await this.tenants.withTransaction(intent.tenantId,async tx=>{
   if(tx.tenantId!==intent.tenantId||tx[PINNED_TENANT_TRANSACTION]!==true)
    throw new AccessDeniedError();
   await tx.query(`
    WITH permitted AS MATERIALIZED (
      SELECT o.tenant_id FROM public.platform_organizations o
      JOIN public.platform_workspaces w ON w.tenant_id=o.tenant_id
       AND w.organization_id=o.id AND w.is_default AND w.status='active'
      JOIN public.platform_org_memberships om ON om.tenant_id=o.tenant_id
       AND om.organization_id=o.id AND om.principal_id=$4
       AND om.role='admin' AND om.state='active'
      JOIN public.platform_workspace_memberships wm ON wm.tenant_id=w.tenant_id
       AND wm.organization_id=w.organization_id AND wm.workspace_id=w.id
       AND wm.principal_id=$4 AND wm.role='admin' AND wm.state='active'
      WHERE o.tenant_id=$1::uuid AND o.is_default AND o.status='active'
        AND NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public'
         AND indexname IN('platform_legacy_single_organization',
                          'platform_legacy_single_workspace'))
      LIMIT 1
    ), created_org AS (
      INSERT INTO public.platform_organizations(tenant_id,id,display_name,is_default)
      SELECT tenant_id,$2::uuid,$5,false FROM permitted
      ON CONFLICT DO NOTHING RETURNING tenant_id,id
    ), created_ws AS (
      INSERT INTO public.platform_workspaces(
       tenant_id,id,organization_id,name,slug,is_default)
      SELECT tenant_id,$3::uuid,id,$6,'principal',true FROM created_org
      RETURNING tenant_id,id,organization_id
    ), org_grant AS (
      INSERT INTO public.platform_org_memberships(
       tenant_id,organization_id,principal_id,role)
      SELECT tenant_id,id,$4,'admin' FROM created_org
      RETURNING tenant_id,organization_id
    ), ws_grant AS (
      INSERT INTO public.platform_workspace_memberships(
       tenant_id,organization_id,workspace_id,principal_id,role)
      SELECT w.tenant_id,w.organization_id,w.id,$4,'admin'
      FROM created_ws w JOIN org_grant g
        ON g.tenant_id=w.tenant_id AND g.organization_id=w.organization_id
      RETURNING workspace_id
    ), audit AS (
      INSERT INTO public.platform_org_audit(
       tenant_id,organization_id,actor_id,event,entity_id)
      SELECT o.tenant_id,o.id,$4,'organization_created',o.id
      FROM created_org o JOIN ws_grant g ON g.workspace_id=$3::uuid
      RETURNING entity_id
    ) SELECT entity_id FROM audit
   `,[intent.tenantId,intent.organizationId,intent.workspaceId,
       intent.founderId,intent.organizationName,intent.workspaceName]);
  });
  if(!await this.verify(intent))throw new AccessDeniedError();
 }
 async verify(intent:OrgProvisionIntent):Promise<boolean>{
  const db=await this.tenants.resolve(intent.tenantId);
  if(db.tenantId!==intent.tenantId)throw new AccessDeniedError();
  const rows=await db.query(`
    SELECT o.id FROM public.platform_organizations o
    JOIN public.platform_workspaces w ON w.tenant_id=o.tenant_id
      AND w.organization_id=o.id AND w.id=$3::uuid AND w.is_default
      AND w.name=$6 AND w.status='active'
    JOIN public.platform_org_memberships om ON om.tenant_id=o.tenant_id
      AND om.organization_id=o.id AND om.principal_id=$4
      AND om.state='active' AND om.role='admin'
    JOIN public.platform_workspace_memberships wm ON wm.tenant_id=w.tenant_id
      AND wm.organization_id=w.organization_id AND wm.workspace_id=w.id
      AND wm.principal_id=$4 AND wm.state='active' AND wm.role='admin'
    WHERE o.tenant_id=$1::uuid AND o.id=$2::uuid AND o.status='active'
      AND o.is_default=false AND o.display_name=$5
    LIMIT 2
  `,[intent.tenantId,intent.organizationId,intent.workspaceId,
      intent.founderId,intent.organizationName,intent.workspaceName]);
  return rows.rows.length===1;
 }
}

/** Never re-grant a founder after the intent became READY: a subsequent
 * Keycloak membership revocation must be respected, not auto-repaired.
 * All endpoints and credentials remain operator-only.
 */
export class OrganizationProvisioningSaga{
 constructor(private readonly ports:Readonly<{
  authorizeOperator(input:OrgProvisionInput):Promise<boolean>;
  intents:OrgProvisionIntentPort;
  keycloak:TrustedKeycloakOrgWriter;
  tenant:TrustedTenantOrgWriter;
  links:TrustedOrgLinkWriter;
 }>){}
 async resume(raw:OrgProvisionInput):Promise<Readonly<{
  ready:true;requestId:string;organizationId:string;workspaceId:string;
  keycloakOrganizationId:string;
 }>>{
  const input=checked(raw);
  if(await this.ports.authorizeOperator(input)!==true||
     await this.ports.tenant.founderIsAdmin(input.tenantId,input.founderId)!==true)
   throw new AccessDeniedError();
  const intent=await this.ports.intents.reserve(input);
  const result=(kcId:string)=>Object.freeze({
   ready:true as const,requestId:intent.requestId,
   organizationId:intent.organizationId,workspaceId:intent.workspaceId,
   keycloakOrganizationId:kcId,
  });
  if(intent.state==="ready"){
   const kc=intent.keycloakOrganizationId;
   if(!kc||!await this.ports.keycloak.isActiveMember(kc,intent.founderId)||
      !await this.ports.tenant.verify(intent)||
      !await this.ports.links.verify(intent,kc))
    throw new AccessDeniedError();
   return result(kc);
  }
  try{
   const kc=await this.ports.keycloak.ensureOrganization(
     intent.keycloakAlias,intent.organizationName);
   if(!UUID.test(kc)||(intent.keycloakOrganizationId&&
      intent.keycloakOrganizationId!==kc))
    throw new AccessDeniedError();
   await this.ports.intents.bindKeycloak(intent.requestId,kc);
   await this.ports.keycloak.ensureMember(kc,intent.founderId);
   if(!await this.ports.keycloak.isActiveMember(kc,intent.founderId))
    throw new AccessDeniedError();
   await this.ports.tenant.ensure(intent);
   if(!await this.ports.tenant.verify(intent))throw new AccessDeniedError();
   await this.ports.links.ensure(intent,kc);
   if(!await this.ports.links.verify(intent,kc)||
      !await this.ports.keycloak.isActiveMember(kc,intent.founderId)||
      !await this.ports.tenant.verify(intent))
    throw new AccessDeniedError();
   await this.ports.intents.markReady(intent.requestId,kc);
   return result(kc);
  }catch{
   try{await this.ports.intents.markReconcileRequired(intent.requestId)}
   catch{/* no ready result without full reconciliation */}
   throw new AccessDeniedError();
  }
 }
}
