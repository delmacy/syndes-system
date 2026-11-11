import {createHash} from "node:crypto";
import {platformEventTypes,type Actor,type PlatformEventType} from "@syndes/core-kernel";
import {tenantUUID} from "./adapters.js";
import type {TrustedServiceEventGrant} from "./platform-event-worker-admission.js";

const MODULE=/^[a-z][a-z0-9_]{0,62}$/;
const CONSUMER=/^[a-z][a-z0-9_.-]{1,95}$/;
const SERVICE=/^[a-z][a-z0-9_.:-]{2,127}$/;
export type ServiceEventGrantRequest=Readonly<{
 actor:Actor;tenantId:string;organizationId:string;workspaceId:string|null;
 moduleId:string;consumerId:string;eventType:PlatformEventType;
}>;

/** Exact per-consumer subject and target, never a general tenant permission.
 * The digest contains no names, phone numbers, JIDs, actor tokens or content.
 * The ':' namespace is a separate OpenFGA event_delivery object type. */
export function fgaEventDeliveryObject(input:Omit<ServiceEventGrantRequest,"actor">):string{
 if(!input||!tenantUUID(input.tenantId)||!tenantUUID(input.organizationId)||
   (input.workspaceId!==null&&!tenantUUID(input.workspaceId))||
   !MODULE.test(input.moduleId)||!CONSUMER.test(input.consumerId)||
   !input.consumerId.startsWith(input.moduleId+".")||
   !platformEventTypes.includes(input.eventType)||
   (input.workspaceId===null&&[
    "whatsapp.message.received.v2","inbox.participant.observed.v1",
    "crm.person.resolved.v1","crm.person.review_required.v1",
   ].includes(input.eventType)))
  throw Error("Invalid worker grant scope");
 const fields=[
  input.tenantId.toLowerCase(),input.organizationId.toLowerCase(),
  input.workspaceId?.toLowerCase()??"no-workspace",
  input.moduleId,input.consumerId,input.eventType,
 ];
 return "event_delivery:"+createHash("sha256").update(fields.join("\x1f")).digest("hex");
}

/** Uses a dedicated *service:* principal. Current user-only resource:can_write
 * tuples NEVER authorize this port. Model migration/tuples are separate gates.
 * Host must inject a verified principal, OpenFGA base URL/store and secret.
 * No worker is started or grant is created by constructing the adapter. */
export class OpenFgaServiceEventGrant implements TrustedServiceEventGrant{
 private readonly endpoint:URL;
 constructor(
  endpoint:string,private readonly storeId:string,private readonly token:string,
  private readonly principalId:string,private readonly send:typeof fetch=fetch,
 ){
  const u=new URL(endpoint);
  if(!["https:","http:"].includes(u.protocol)||u.username||u.password||
    u.search||u.hash||u.pathname!=="/"||!u.hostname||
    (u.protocol==="http:"&&!["openfga","localhost","127.0.0.1"].includes(u.hostname))||
    !/^[A-Za-z0-9_-]{8,128}$/.test(storeId)||
    typeof token!=="string"||token.length<8||
    !SERVICE.test(principalId)||!send)
   throw Error("Trusted OpenFGA worker grant configuration required");
  this.endpoint=u;
 }
 async canProcess(request:ServiceEventGrantRequest):Promise<boolean>{
  if(!request||request.actor?.kind!=="service"||
    request.actor.id!==this.principalId)
   throw Error("Untrusted worker service identity");
  const object=fgaEventDeliveryObject(request);
  const response=await this.send(new URL(
   "/stores/"+encodeURIComponent(this.storeId)+"/check",this.endpoint),{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+this.token},
    body:JSON.stringify({tuple_key:{
     user:"service:"+this.principalId,relation:"can_process",object,
    }}),
    signal:AbortSignal.timeout(3000),
  });
  if(!response.ok)throw Error("OpenFGA service grant unavailable");
  const result:unknown=await response.json();
  const allowed=(result as {allowed?:unknown}|null)?.allowed;
  if(typeof allowed!=="boolean")throw Error("Invalid OpenFGA service grant reply");
  return allowed===true;
 }
}
