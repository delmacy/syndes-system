import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {OpenFgaServiceEventGrant,fgaEventDeliveryObject}
 from "../dist/platform-event-service-grant.js";
import {TenantEventWorkerAdmission} from "../dist/platform-event-worker-admission.js";

/** Explicitly skipped unless the operator launched the dedicated in-memory
 * disposable container. Never contacts the operational OpenFGA store. */
const FIXTURE="syndes-events-fga-disposable-20261111";
const BASE="http://127.0.0.1:18089";
const enabled=process.env.SYNDES_EVENTS_FGA_DISPOSABLE==="EVENTS_FGA_IN_MEMORY_ONLY"
 &&process.env.SYNDES_EVENTS_FGA_URL===BASE;

test("OpenFGA v1.22 in-memory: service can_process is exact and revocable",
 {skip:!enabled},async t=>{
 const container=JSON.parse(execFileSync(
  "docker",["inspect",FIXTURE],{encoding:"utf8",timeout:5000}))[0];
 assert.equal(container.Config.Image,"openfga/openfga:v1.22.1");
 assert.equal(container.Config.Labels["syndes.disposable"],"event-fga-model");
 assert.equal(container.HostConfig.NetworkMode,"bridge");
 assert.ok(container.NetworkSettings.Ports["8080/tcp"].some(p=>
  p.HostIp==="127.0.0.1"&&p.HostPort==="18089"));

 const api=async(method,path,payload)=>{
  const response=await fetch(BASE+path,{
   method,headers:{"Content-Type":"application/json"},
   body:payload===undefined?undefined:JSON.stringify(payload),
   signal:AbortSignal.timeout(5000),
  });
  if(!response.ok)throw Error("Disposable OpenFGA request failed: "+method+" "+response.status);
  return response.json();
 };
 const store=await api("POST","/stores",{name:"syndes-events-fixture-"+randomUUID()});
 assert.match(store.id,/^[A-Za-z0-9_-]{8,128}$/);
 const model=JSON.parse(await readFile(
  new URL("../../../infra/security-access/fga-model.json",import.meta.url),"utf8"));
 const result=await api("POST","/stores/"+store.id+"/authorization-models",model);
 assert.ok(result.authorization_model_id);

 const tenantId=randomUUID(),organizationId=randomUUID(),workspaceId=randomUUID();
 const scope={
  actor:{kind:"service",id:"syndes-events-service"},
  tenantId,organizationId,workspaceId,
  moduleId:"inbox",consumerId:"inbox.message-received-v2",
  eventType:"whatsapp.message.received.v2",
 };
 const object=fgaEventDeliveryObject(scope);
 const tuple={
  user:"service:syndes-events-service",relation:"processor",object,
 };
 const permission=new OpenFgaServiceEventGrant(
  BASE,store.id,"disposable-only-token","syndes-events-service");

 await t.test("unprovisioned worker is denied, no default or tenant-wide rights",async()=>{
  assert.equal(await permission.canProcess(scope),false);
  assert.equal(await permission.canProcess({...scope,tenantId:randomUUID()}),false);
 });
 await api("POST","/stores/"+store.id+"/write",{writes:{tuple_keys:[tuple]}});
 await t.test("specific service permission is granted without user impersonation",async()=>{
  assert.equal(await permission.canProcess(scope),true);
  const denied=new OpenFgaServiceEventGrant(
   BASE,store.id,"disposable-only-token","another-service");
  assert.equal(await denied.canProcess({...scope,actor:{kind:"service",id:"another-service"}}),false);
 });
 await t.test("tenant, organization, workspace, module, consumer and type cannot borrow grant",async()=>{
  const altered=[
   {...scope,tenantId:randomUUID()},
   {...scope,organizationId:randomUUID()},
   {...scope,workspaceId:randomUUID()},
   {...scope,moduleId:"crm",consumerId:"crm.resolve-person"},
   {...scope,consumerId:"inbox.crm-person-link"},
   {...scope,eventType:"crm.person.resolved.v1"},
  ];
  for(const input of altered)
   assert.equal(await permission.canProcess(input),false,
    input.moduleId+"/"+input.consumerId+"/"+input.eventType);
 });
 await t.test("real OpenFGA grant is admitted only through the trusted service worker policy",async()=>{
  const admission=new TenantEventWorkerAdmission({
   canExecuteModule:async q=>q.actor.kind==="service"&&q.moduleId==="inbox",
  },{active:async()=>true},permission,scope.actor.id);
  assert.equal(await admission.authorize(scope),"enabled");
  assert.equal(await admission.authorize({...scope,tenantId:randomUUID()}),"denied");
  assert.equal(await admission.authorize({...scope,actor:{kind:"user",id:scope.actor.id}}),"denied");
 });
 await t.test("legacy user permission model remains separately functional",async()=>{
  await api("POST","/stores/"+store.id+"/write",{writes:{tuple_keys:[
   {user:"user:fixture",relation:"editor",object:"resource:legacy"},
  ]}});
  const x=await api("POST","/stores/"+store.id+"/check",{tuple_key:{
   user:"user:fixture",relation:"can_write",object:"resource:legacy",
  }});
  assert.equal(x.allowed,true);
 });
 await t.test("revoked processor grant immediately denies future checks",async()=>{
  await api("POST","/stores/"+store.id+"/write",{deletes:{tuple_keys:[tuple]}});
  assert.equal(await permission.canProcess(scope),false);
 });
});
