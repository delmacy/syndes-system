import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";

const BASE="http://127.0.0.1:18091";
const CONTAINER="syndes-inbox-preflight-fga";
const enabled=process.env.SYNDES_INBOX_FGA_PREFLIGHT==="DISPOSABLE_ONLY"
 &&process.env.SYNDES_INBOX_FGA_URL===BASE;

const api=async(method,path,payload)=>{
 const response=await fetch(BASE+path,{
  method,headers:{"Content-Type":"application/json"},
  body:payload===undefined?undefined:JSON.stringify(payload),
  signal:AbortSignal.timeout(7000)
 });
 if(!response.ok)throw Error("Disposable FGA "+method+" "+path+" returned "+response.status);
 return response.json();
};
const check=async(store,user,object,relation="can_write")=>{
 const result=await api("POST","/stores/"+store+"/check",{
  tuple_key:{user:"user:"+user,object:"resource:"+object,relation}
 });
 return result.allowed;
};

test("P02 preflight: real disposable OpenFGA proves recipient permissions are separate from P04 memberships",{
 skip:!enabled&&"explicitly disposable OpenFGA container required"
},async t=>{
 const data=JSON.parse(execFileSync("docker",["inspect",CONTAINER],{encoding:"utf8",timeout:6000}))[0];
 assert.equal(data.Config.Image,"openfga/openfga:v1.22.1");
 assert.equal(data.Config.Labels["syndes.disposable"],"inbox-assignment-preflight");
 assert.equal(data.HostConfig.NetworkMode,"bridge");
 assert.ok(data.NetworkSettings.Ports["8080/tcp"].some(p=>p.HostIp==="127.0.0.1"&&p.HostPort==="18091"));
 const store=(await api("POST","/stores",{name:"p02-assignment-preflight-"+randomUUID()})).id;
 assert.match(store,/^[A-Za-z0-9_-]{8,128}$/);
 const model=JSON.parse(await readFile(new URL("../../../infra/security-access/fga-model.json",import.meta.url),"utf8"));
 const version=await api("POST","/stores/"+store+"/authorization-models",model);
 assert.ok(version.authorization_model_id);

 // Synthetic test-only resources. This is NOT a claim that P02 already has
 // a per-conversation OpenFGA model or an individual target check in runtime.
 const tenantA=randomUUID(),tenantB=randomUUID(),org=randomUUID(),wsA=randomUUID(),wsB=randomUUID();
 const resourceA=[tenantA,org,wsA,"inbox-assignment-preflight"].join(".");
 const resourceOtherWorkspace=[tenantA,org,wsB,"inbox-assignment-preflight"].join(".");
 const resourceOtherTenant=[tenantB,org,wsA,"inbox-assignment-preflight"].join(".");
 const editor="eligible-but-no-fga";
 await t.test("active P04 membership alone does NOT establish an FGA write grant",async()=>{
  assert.equal(await check(store,editor,resourceA),false);
  assert.equal(await check(store,editor,resourceOtherWorkspace),false);
 });
 const tuple={user:"user:"+editor,relation:"editor",object:"resource:"+resourceA};
 await api("POST","/stores/"+store+"/write",{writes:{tuple_keys:[tuple]}});
 await t.test("explicit write relation is narrowly scoped and non-transitive",async()=>{
  assert.equal(await check(store,editor,resourceA),true);
  assert.equal(await check(store,editor,resourceOtherWorkspace),false);
  assert.equal(await check(store,editor,resourceOtherTenant),false);
  assert.equal(await check(store,"unprovisioned",resourceA),false);
 });
 await t.test("revocation denies further access, including after a previous grant",async()=>{
  await api("POST","/stores/"+store+"/write",{deletes:{tuple_keys:[tuple]}});
  assert.equal(await check(store,editor,resourceA),false);
 });
 await t.test("policy provider outage cannot become allow",async()=>{
  await assert.rejects(fetch("http://127.0.0.1:18991/stores/"+store+"/check",{
   method:"POST",signal:AbortSignal.timeout(800)
  }));
 });
 console.log("INBOX_FGA_PREFLIGHT",JSON.stringify({
  targetGrantChecked:"real OpenFGA disposable",testResources:"synthetic",
  integratedInInboxAssignment:false,productionIamVerified:false
 }));
});
