/**
 * IAM-07D2: CANDIDATE-only fine OpenFGA policy, never imported by main.ts.
 * A dedicated iam_capability object type has NO tenant-admin, editor,
 * can_write or event_delivery inheritance. Verified identity/context and
 * module admission remain separate mandatory preconditions.
 */
import {createHash} from "node:crypto";
import type {ResolvedIamPilotContext} from "./iam-organization-context-pilot.js";
import type {SpecificIam07dCapability,SpecificIam07dPolicy}
 from "./iam07d-revoke-first-pilot.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CAPS=new Set<SpecificIam07dCapability>([
 "inbox.conversation.claim","inbox.conversation.transfer","service.funnel.operate",
]);
const SCOPE_PREFIX="syndes:v1:tenant:";
const equalString=(value:unknown):value is string=>typeof value==="string"&&value.length>0;
/** Exact immutable context; do not accept browser-selected resources or raw
 * arbitrary FGA object names. Funnel ID is explicit in trusted resourceName.
 * All inputs must already come from OrganizationContextAdmissionPilot.
 */
export function iam07dFineObject(context:ResolvedIamPilotContext,
 capability:SpecificIam07dCapability):string{
 if(!context||context.actor?.kind!=="user"||
   !UUID.test(context.actor.id)||
   ![context.tenantId,context.organizationId,context.workspaceId,
      context.keycloakOrganizationId].every(v=>typeof v==="string"&&UUID.test(v))||
   !CAPS.has(capability)||context.capability!==capability||
   context.scopeWriteAllowed!==true||
   context.moduleId!==(capability==="service.funnel.operate"?"service":"inbox")||
   !equalString(context.realm))
  throw Error("Untrusted fine capability identity");
 const base=SCOPE_PREFIX+context.tenantId+":org:"+context.organizationId+
  ":workspace:"+context.workspaceId;
 const resource=context.resourceName;
 if(capability==="service.funnel.operate"){
  if(typeof resource!=="string"||!resource.startsWith(base+":funnel:")||
    !UUID.test(resource.slice((base+":funnel:").length)))
   throw Error("Verified funnel ownership required");
 }else if(resource!==base)
  throw Error("Verified workspace scope required");
 // Distinct capability and funnel resource derive distinct 256-bit object IDs.
 const fields=["v1",context.tenantId,context.organizationId,
   context.workspaceId,capability,resource];
 return "iam_capability:"+createHash("sha256")
  .update(fields.join("\x1f")).digest("hex");
}
function trustedOrigin(endpoint:string):URL{
 let parsed:URL;
 try{parsed=new URL(endpoint);}catch{throw Error("Invalid fine OpenFGA endpoint");}
 const loopback=parsed.protocol==="http:"&&
  ["localhost","127.0.0.1","openfga"].includes(parsed.hostname);
 if((parsed.protocol!=="https:"&&!loopback)||parsed.username||parsed.password||
    parsed.search||parsed.hash||parsed.pathname!=="/"||!parsed.hostname)
  throw Error("Invalid fine OpenFGA endpoint");
 return parsed;
}
type Send=typeof fetch;
/** Read-only exact fine grant check. Every transport or malformed response
 * must reject; the IAM admission caller turns it into DENY. */
export class OpenFgaFineCapabilityPolicy implements SpecificIam07dPolicy{
 private readonly base:URL;
 constructor(endpoint:string,private readonly storeId:string,
  private readonly token:string,private readonly send:Send=fetch){
  this.base=trustedOrigin(endpoint);
  if(!/^[A-Za-z0-9_-]{8,128}$/.test(storeId)||
    !equalString(token)||token.length<8||typeof send!=="function")
   throw Error("Trusted fine OpenFGA configuration required");
 }
 async canPerform(context:ResolvedIamPilotContext,
  capability:SpecificIam07dCapability):Promise<boolean>{
  const object=iam07dFineObject(context,capability);
  const response=await this.send(new URL(
   "/stores/"+encodeURIComponent(this.storeId)+"/check",this.base),{
   method:"POST",
   headers:{"Content-Type":"application/json",Authorization:"Bearer "+this.token},
   body:JSON.stringify({tuple_key:{
    user:"user:"+context.actor.id,relation:"can_execute",object,
   }}),
   signal:AbortSignal.timeout(3000),redirect:"error",cache:"no-store",
  });
  if(response.status!==200)throw Error("OpenFGA fine capability unavailable");
  const answer:unknown=await response.json();
  if(answer===null||typeof answer!=="object"||
    typeof (answer as {allowed?:unknown}).allowed!=="boolean")
   throw Error("OpenFGA fine capability reply invalid");
  return (answer as {allowed:boolean}).allowed===true;
 }
}
