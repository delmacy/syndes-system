/** UC-SIGNUP-01B: durable operator-only reservation for the FIRST tenant.
 * Distinct from iam-org-provisioning-operator (additional Organization).
 * No HTTP route, DSN, Keycloak password, FGA grant or tenant creation here.
 */
import {randomUUID} from "node:crypto";
import {AccessDeniedError} from "@syndes/core-kernel";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NAME=(x:unknown):x is string=>typeof x==="string"&&
 x.trim().length>=2&&x.trim().length<=160&&
 ![...x].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127);
type PgQuery={query(sql:string,values:readonly unknown[]):Promise<{
 rows:Record<string,unknown>[];rowCount:number|null;
}>};
export type SignupReservationInput=Readonly<{
 requestId:string;founderId:string;accountName:string;
 organizationName:string;workspaceName:string;
}>;
export type SignupReservation=Readonly<SignupReservationInput&{
 tenantId:string;organizationId:string;workspaceId:string;
 state:"reserved"|"reconcile_required"|"ready";revision:number;
}>;

function validate(raw:SignupReservationInput):SignupReservationInput{
 if(!raw||!UUID.test(raw.requestId)||!UUID.test(raw.founderId)||
    !NAME(raw.accountName)||!NAME(raw.organizationName)||!NAME(raw.workspaceName))
  throw new AccessDeniedError();
 return Object.freeze({
  requestId:raw.requestId.toLowerCase(),founderId:raw.founderId.toLowerCase(),
  accountName:raw.accountName.trim(),organizationName:raw.organizationName.trim(),
  workspaceName:raw.workspaceName.trim(),
 });
}
function decode(row:Record<string,unknown>):SignupReservation{
 const revision=Number(row.revision);
 if(!["request_id","founder_id","tenant_id","organization_id","workspace_id"].every(
   k=>typeof row[k]==="string"&&UUID.test(row[k] as string))||
   !NAME(row.account_name)||!NAME(row.organization_name)||!NAME(row.workspace_name)||
   !["reserved","reconcile_required","ready"].includes(String(row.state))||
   !Number.isSafeInteger(revision)||revision<1)
   throw new AccessDeniedError();
 return Object.freeze({
  requestId:row.request_id as string,founderId:row.founder_id as string,
  tenantId:row.tenant_id as string,organizationId:row.organization_id as string,
  workspaceId:row.workspace_id as string,accountName:row.account_name as string,
  organizationName:row.organization_name as string,
  workspaceName:row.workspace_name as string,
  state:row.state as SignupReservation["state"],revision,
 });
}

/** Pool must be bound to the isolated NOLOGIN syndes_signup_operator role
 * by an independently authorized operator runner. authorizeFounder must be
 * backed by verified OIDC/Keycloak policy, never by a browser boolean.
 */
export class PgSignupReservationStore{
 constructor(private readonly control:PgQuery,
  private readonly authorizeFounder:(founderId:string)=>Promise<boolean>){
  if(!control?.query||typeof authorizeFounder!=="function")throw new AccessDeniedError();
 }
 private async authorized(founder:string){
  if(!UUID.test(founder)||await this.authorizeFounder(founder)!==true)
   throw new AccessDeniedError();
 }
 async reserve(raw:SignupReservationInput):Promise<SignupReservation>{
  const input=validate(raw);
  await this.authorized(input.founderId);
  const tenantId=randomUUID(),organizationId=randomUUID(),workspaceId=randomUUID();
  const alias="syndes-"+tenantId.replaceAll("-","")+"-"+input.requestId.replaceAll("-","");
  // One atomic insert+audit. Conflict does not update, grant or mutate an
  // existing reservation, even if a different principal guesses requestId.
  await this.control.query(`
   WITH inserted AS (
    INSERT INTO public.platform_signup_intents(
      request_id,founder_id,tenant_id,organization_id,workspace_id,
      account_name,organization_name,workspace_name,keycloak_alias)
    VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6,$7,$8,$9)
    ON CONFLICT(request_id) DO NOTHING
    RETURNING request_id,revision
   ) INSERT INTO public.platform_signup_intent_audit(request_id,revision,event)
     SELECT request_id,revision,'reserved' FROM inserted
  `,[input.requestId,input.founderId,tenantId,organizationId,workspaceId,
    input.accountName,input.organizationName,input.workspaceName,alias]);
  const record=await this.get(input.requestId,input.founderId);
  if(record.accountName!==input.accountName||
     record.organizationName!==input.organizationName||
     record.workspaceName!==input.workspaceName)throw new AccessDeniedError();
  return record;
 }
 async get(requestId:string,founderId:string):Promise<SignupReservation>{
  if(!UUID.test(requestId)||!UUID.test(founderId))throw new AccessDeniedError();
  const request=requestId.toLowerCase(),founder=founderId.toLowerCase();
  await this.authorized(founder);
  const result=await this.control.query(`
   SELECT request_id::text,founder_id::text,tenant_id::text,
          organization_id::text,workspace_id::text,account_name,
          organization_name,workspace_name,state,revision
   FROM public.platform_signup_intents
   WHERE request_id=$1::uuid AND founder_id=$2::uuid
  `,[request,founder]);
  if(result.rows.length!==1)throw new AccessDeniedError();
  return decode(result.rows[0]);
 }
 async markReconcileRequired(requestId:string,founderId:string):Promise<void>{
  if(!UUID.test(requestId)||!UUID.test(founderId))throw new AccessDeniedError();
  await this.authorized(founderId.toLowerCase());
  const changed=await this.control.query(`
   WITH updated AS (
    UPDATE public.platform_signup_intents
      SET state='reconcile_required',revision=revision+1,
       changed_at=clock_timestamp()
    WHERE request_id=$1::uuid AND founder_id=$2::uuid AND state='reserved'
    RETURNING request_id,revision
   ) INSERT INTO public.platform_signup_intent_audit(request_id,revision,event)
     SELECT request_id,revision,'reconcile_required' FROM updated
     RETURNING event_id
  `,[requestId,founderId]);
  if(changed.rows.length>1)throw new AccessDeniedError();
  const state=await this.get(requestId,founderId);
  if(state.state!=="reconcile_required")throw new AccessDeniedError();
 }
}
