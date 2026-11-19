/** UC-SIGNUP-01C: only the first Organization DIRECTORY read grant.
 * Never creates tenant:admin, module-wide CRM/Inbox or a fine IAM07D tuple.
 * The human identity is the verified Keycloak sub (founderId).
 * This operator is never mounted in the Core Host/runtime or in the browser.
 */
import {AccessDeniedError} from "@syndes/core-kernel";
import {fgaResourceObject} from "./adapters.js";
import type {SignupReservation} from "./signup-control-intents.js";
import type {FirstTenantFgaPort} from "./signup-first-tenant-saga.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID=/^[A-Za-z0-9_-]{8,128}$/;
type Tuple=Readonly<{user:string;relation:string;object:string}>;
export class OpenFgaInitialTenantGrant implements FirstTenantFgaPort{
 private readonly origin:URL;
 constructor(base:string,private readonly storeId:string,
  private readonly token:string,private readonly send:typeof fetch=fetch){
  this.origin=new URL(base);
  const loopback=this.origin.protocol==="http:"&&
   ["openfga","localhost","127.0.0.1"].includes(this.origin.hostname);
  if((this.origin.protocol!=="https:"&&!loopback)||
    this.origin.username||this.origin.password||this.origin.search||
    this.origin.hash||this.origin.pathname!=="/"||!ID.test(storeId)||
    typeof token!=="string"||token.length<8||typeof send!=="function")
   throw new AccessDeniedError();
 }
 private tuple(intent:SignupReservation):Tuple{
  if(!UUID.test(intent?.founderId)||!UUID.test(intent?.tenantId)||
    !UUID.test(intent?.organizationId)||!UUID.test(intent?.workspaceId))
   throw new AccessDeniedError();
  return Object.freeze({user:"user:"+intent.founderId,
   relation:"viewer",object:fgaResourceObject(intent.tenantId,
    "organizations:directory")});
 }
 private async call(path:"read"|"write",body:unknown):Promise<unknown>{
  const r=await this.send(new URL("/stores/"+encodeURIComponent(this.storeId)+
    "/"+path,this.origin),{
   method:"POST",redirect:"error",cache:"no-store",
   signal:AbortSignal.timeout(3000),
   headers:{"Content-Type":"application/json",Authorization:"Bearer "+this.token},
   body:JSON.stringify(body),
  });
  if(r.status!==200&&r.status!==204)throw new AccessDeniedError();
  if(r.status===204)return {};
  return r.json();
 }
 private async direct(tuple:Tuple):Promise<boolean>{
  const found=await this.call("read",{
   tuple_key:tuple,page_size:2,
  }) as {tuples?:unknown}|null;
  if(!found||!Array.isArray(found.tuples)||found.tuples.length>1)
   throw new AccessDeniedError();
  return found.tuples.length===1&&
   !!found.tuples[0]&&typeof found.tuples[0]==="object"&&
   (found.tuples[0] as {key?:Tuple}).key?.user===tuple.user&&
   (found.tuples[0] as {key?:Tuple}).key?.relation===tuple.relation&&
   (found.tuples[0] as {key?:Tuple}).key?.object===tuple.object;
 }
 async verifyMinimum(intent:SignupReservation):Promise<boolean>{
  const exact=this.tuple(intent);
  // A tenant:admin relation could grant all resource permissions through the
  // existing FGA model. Do not accept that as minimal signup onboarding.
  const privileged=await this.call("read",{
   tuple_key:{user:exact.user,relation:"admin",object:"tenant:"+intent.tenantId},
   page_size:2,
  }) as {tuples?:unknown}|null;
  if(!privileged||!Array.isArray(privileged.tuples)||
     privileged.tuples.length!==0)throw new AccessDeniedError();
  return this.direct(exact);
 }
 async ensureMinimum(intent:SignupReservation):Promise<void>{
  const tuple=this.tuple(intent);
  if(await this.verifyMinimum(intent))return;
  await this.call("write",{
    writes:{tuple_keys:[tuple]},
    authorization_model_id:undefined,
  });
  if(!await this.verifyMinimum(intent))throw new AccessDeniedError();
 }
}
