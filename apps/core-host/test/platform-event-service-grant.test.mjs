import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID,createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {fgaEventDeliveryObject,OpenFgaServiceEventGrant}
 from "../dist/platform-event-service-grant.js";

const tenantId=randomUUID(),organizationId=randomUUID(),workspaceId=randomUUID();
const req={
 actor:{kind:"service",id:"syndes-events-service"},
 tenantId,organizationId,workspaceId,
 moduleId:"inbox",consumerId:"inbox.message-received-v2",
 eventType:"whatsapp.message.received.v2",
};
const storeId="01SYNDESDISPOSABLEMODEL00001";
const token="disposable-only-token";
const make=(send)=>new OpenFgaServiceEventGrant(
 "https://openfga.example/",storeId,token,req.actor.id,send);

test("exact event_delivery grant object has no plaintext tenant or customer content",()=>{
 const out=fgaEventDeliveryObject(req);
 const expected=createHash("sha256").update([
  tenantId,organizationId,workspaceId,req.moduleId,req.consumerId,req.eventType,
 ].join("\x1f")).digest("hex");
 assert.equal(out,"event_delivery:"+expected);
 assert.match(out,/^event_delivery:[a-f0-9]{64}$/);
 assert.equal(out.includes(tenantId),false);
 assert.equal(out.includes(organizationId),false);
 const dimensions=[
  {tenantId:randomUUID()},{organizationId:randomUUID()},
  {workspaceId:randomUUID()},{consumerId:"inbox.crm-person-link"},
  {eventType:"crm.person.resolved.v1"},{moduleId:"crm",consumerId:"crm.resolve-person"},
 ];
 for(const change of dimensions){
  assert.notEqual(fgaEventDeliveryObject({...req,...change}),out);
 }
});

test("known event types and scope mandatory; no default-organization or wildcard bypass",()=>{
 for(const x of [
  {...req,tenantId:"../../tenant"}, {...req,organizationId:"broken"},
  {...req,workspaceId:""}, {...req,workspaceId:null},
  {...req,moduleId:"crm",consumerId:"inbox.message-received-v2"},
  {...req,eventType:"unknown.whatever.v2"},
 ]){
  assert.throws(()=>fgaEventDeliveryObject(x),/Invalid worker grant/);
 }
 assert.match(fgaEventDeliveryObject({...req,workspaceId:null,eventType:"crm.person.created.v1"}),
  /^event_delivery:[a-f0-9]{64}$/);
});

test("real adapter uses service: principal only; no user token or tenant-agnostic grant",async()=>{
 const calls=[];
 const fake=async(url,options)=>{
  calls.push({url:String(url),options});
  return new Response(JSON.stringify({allowed:true}),{status:200,
   headers:{"content-type":"application/json"}});
 };
 assert.equal(await make(fake).canProcess(req),true);
 assert.equal(calls.length,1);
 const {url,options}=calls[0];
 assert.equal(url,"https://openfga.example/stores/"+storeId+"/check");
 assert.equal(options.method,"POST");
 assert.equal(options.headers.Authorization,"Bearer "+token);
 const body=JSON.parse(options.body);
 assert.deepEqual(body,{
  tuple_key:{
   user:"service:syndes-events-service",
   relation:"can_process",
   object:fgaEventDeliveryObject(req),
  }
 });
 assert.ok(options.signal instanceof AbortSignal);
 assert.equal(options.body.includes("user:"),false);
 assert.equal(options.body.includes(tenantId),false);
});

test("explicit false denies; provider outage and invalid reply throw for suspension",async()=>{
 const send=async(_,opts)=>new Response(JSON.stringify({allowed:false}),{status:200});
 assert.equal(await make(send).canProcess(req),false);
 for(const response of [
  new Response("{}",{status:200}),
  new Response('{"allowed":"yes"}',{status:200}),
  new Response("{}",{status:503}),
 ]){
  await assert.rejects(make(async()=>response).canProcess(req),/OpenFGA|Invalid/);
 }
 await assert.rejects(make(async()=>{throw Error("network down")}).canProcess(req),/network down/);
});

test("spoofed identity or forged scope never invokes FGA",async()=>{
 let calls=0;
 const grant=make(async()=>{calls++;throw Error("unexpected network")});
 for(const query of [
  {...req,actor:{kind:"user",id:req.actor.id}},
  {...req,actor:{kind:"service",id:"evil"}},
  {...req,actor:{kind:"service",id:""}},
  {...req,workspaceId:null},
 ]){
  await assert.rejects(grant.canProcess(query),/Untrusted|Invalid/);
 }
 assert.equal(calls,0);
});

test("adapter config requires explicit store, principal and token; no remote http",()=>{
 for(const args of [
  ["http://unsafe.example/","store123456",token,req.actor.id],
  ["https://openfga.example/path","store123456",token,req.actor.id],
  ["https://openfga.example/","../bad",token,req.actor.id],
  ["https://openfga.example/","store123456","",req.actor.id],
  ["https://openfga.example/","store123456",token,""],
 ]){
  assert.throws(()=>new OpenFgaServiceEventGrant(...args),/Trusted/);
 }
});

test("FGA model isolates service and worker relation from legacy user permissions",async()=>{
 const model=JSON.parse(await readFile(
  new URL("../../../infra/security-access/fga-model.json",import.meta.url),"utf8"));
 const byType=new Map(model.type_definitions.map(x=>[x.type,x]));
 assert.ok(byType.has("user")&&byType.has("tenant")&&byType.has("resource"));
 assert.ok(byType.has("service")&&byType.has("event_delivery"));
 const worker=byType.get("event_delivery");
 assert.deepEqual(worker.metadata.relations.processor.directly_related_user_types,[{type:"service"}]);
 assert.deepEqual(worker.relations.can_process,{computedUserset:{object:"",relation:"processor"}});
 assert.equal(Object.hasOwn(byType.get("resource").relations,"can_process"),false);
 assert.equal(Object.hasOwn(byType.get("user"),"relations"),false);
});
