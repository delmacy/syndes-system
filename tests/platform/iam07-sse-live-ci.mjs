/**
 * IAM-07A live SSE revocation lab; called ONLY by IAM-06B's disposable real
 * Keycloak+Control PG17+tenant PG17+OpenFGA fixture. All bearer/subject IDs
 * remain in process; CI logs contain only PASS codes and non-PII duration.
 */
import assert from "node:assert/strict";
import {performance} from "node:perf_hooks";
import {Iam07SseSessionPilot} from "../../apps/core-host/dist/iam07-sse-session-pilot.js";
import {FgaPermission} from "../../apps/core-host/dist/adapters.js";
import {InboxChangeBus} from "../../modules/inbox/dist/index.js";

const TENANT="11111111-1111-4111-8111-111111111111";
const ORG="22222222-2222-4222-8222-222222222222";
const WS="44444444-4444-4444-8444-444444444444";
const FGA="http://127.0.0.1:18089";
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(verify,label,deadline=12000){
 const start=performance.now();
 while(performance.now()-start<deadline){
  if(verify())return;
  await pause(25);
 }
 throw Error("IAM07_"+label+"_TIMEOUT");
}
function stream(bus,session){
 const frames=[];
 const sink={
  setHeader:()=>{},
  write:frame=>{frames.push(frame);return true;},
  end:()=>{frames.push("END");},
  on:()=>{},
 };
 bus.connect(session.address,sink,session.revalidate,10000,9000);
 return {
  frames,
  changed:()=>frames.filter(f=>f.startsWith("event: changed")).length,
  ended:()=>frames.includes("END"),
 };
}
export async function runIam07SseLiveLab(fixture){
 const {
  admission,fgaAdapter,bearer,request,control,tenantDb,alice,
  memberOrgId,adminToken,tuples,storeId,fgaWrite,
  linkTransition,linkRequest,changeMembership,
 }=fixture;
 assert.equal(process.env.CI_MASTER_REAL_PG,"1");
 assert.equal(process.env.SYNDES_IAM06B_REAL,"IAM06B_DISPOSABLE_ONLY");
 assert.equal(request.tenantId,TENANT);
 assert.equal(request.organizationId,ORG);
 assert.equal(request.workspaceId,WS);
 assert.equal(request.capability,"inbox.conversation.read");
 assert.ok(typeof alice==="string"&&typeof bearer==="string");
 assert.match(bearer,/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
 const pilot=new Iam07SseSessionPilot(admission,fgaAdapter);
 const bus=new InboxChangeBus(3);
 const open=()=>pilot.open(bearer,request);
 let session=await open();
 let streamA=stream(bus,session);
 await until(()=>streamA.changed()===1,"INITIAL_STREAM");
 assert.equal(streamA.ended(),false);

 // CI fixture microbenchmark: sequential checks with real signed JWT,
 // Keycloak membership, Control, tenant SQL and OpenFGA. Not production SLA.
 const timings=[];
 for(let i=0;i<14;i++){
  const start=performance.now();
  assert.equal(await session.revalidate(),true);
  timings.push(performance.now()-start);
 }
 timings.sort((a,b)=>a-b);
 const p95=timings[Math.ceil(.95*timings.length)-1];
 assert.ok(Number.isFinite(p95)&&p95>0&&p95<9000,
  "IAM-07 p95 result must remain within its existing bounded SSE deadline");
 console.log("IAM07_REAL_CI_REVALIDATION_P95_MS="+Math.ceil(p95)+
  "_N="+timings.length+"_DISPOSABLE_NOT_SLA");

 // An unrelated tenant/org/workspace cannot trigger a notification on A.
 bus.publish({tenantId:"99999999-9999-4999-8999-999999999999",
  organizationId:ORG,workspaceId:WS});
 bus.publish({tenantId:TENANT,organizationId:"33333333-3333-4333-8333-333333333333",
  workspaceId:"55555555-5555-4555-8555-555555555555"});
 await pause(50);
 assert.equal(streamA.changed(),1);
 await assert.rejects(openWithSelection(pilot,bearer,{
  ...request,organizationId:"33333333-3333-4333-8333-333333333333"
 }),/admission denied/);

 async function revoked(label,mutate,restore){
  session=await open();
  // Reuse the active stream on first iteration, new stream for subsequent.
  if(streamA.ended()){
   streamA=stream(bus,session);
   await until(()=>streamA.changed()===1,label+"_REOPEN");
  }
  const before=streamA.changed();
  try{
   await mutate();
   bus.publish(session.address);
   await until(()=>streamA.ended(),label+"_END");
   assert.equal(streamA.changed(),before,
    "Revoked stream must not publish after "+label);
   assert.equal(bus.count(session.address),0);
  }finally{await restore();}
 }

 // The live FGA store is the SAME store used by IAM-06B; UMA remains
 // independently allowed and cannot reopen SSE after an OpenFGA DENY.
 await revoked("FGA",()=>fgaWrite("POST","/stores/"+storeId+"/write",{
  deletes:{tuple_keys:[tuples[0]]}
 }),()=>fgaWrite("POST","/stores/"+storeId+"/write",{
  writes:{tuple_keys:[tuples[0]]}
 }));

 // SQL membership row revocation while JWT/Keycloak and FGA still allow.
 await revoked("TENANT_SQL",()=>tenantDb.query(
  "UPDATE platform_workspace_memberships SET state='revoked'"+
  " WHERE tenant_id=$1 AND principal_id=$2",[TENANT,alice]),
  ()=>tenantDb.query(
   "UPDATE platform_workspace_memberships SET state='active'"+
   " WHERE tenant_id=$1 AND principal_id=$2",[TENANT,alice])
 );

 // Control DB module entitlement and immutable Keycloak org link revocation.
 await revoked("MODULE",()=>control.query(
  "UPDATE tenant_module_entitlements SET state='suspended'"+
  " WHERE tenant_id=$1 AND module_id='inbox'",[TENANT]),
  ()=>control.query(
   "UPDATE tenant_module_entitlements SET state='granted'"+
   " WHERE tenant_id=$1 AND module_id='inbox'",[TENANT])
 );
 await revoked("CONTROL_LINK",
  ()=>linkTransition(control,linkRequest("revoked",1)),
  ()=>linkTransition(control,linkRequest("active",2))
 );

 // Existing signed human token is still valid, but removal from the
 // live Keycloak Organization makes the SAME SSE session fail closed.
 await revoked("KEYCLOAK_ORG",
  ()=>changeMembership("DELETE",memberOrgId,alice,adminToken),
  ()=>changeMembership("POST",memberOrgId,alice,adminToken)
 );

 // Invalid FGA transport cannot authorize a new stream even when all
 // memberships/PG records permit. Loopback closed-port fault injection, not
 // a claim of having killed/recovered the operational FGA service.
 const unavailable=new Iam07SseSessionPilot(admission,
  new FgaPermission("http://127.0.0.1:18098",storeId,"ci-disposable-only"));
 await assert.rejects(unavailable.open(bearer,request),/admission denied/);
 console.log("IAM07_REAL_SSE_FGA_SQL_MODULE_LINK_ORG_REVOCATION_PASS");
 console.log("IAM07_REAL_SSE_CROSS_SCOPE_AND_PROVIDER_FAILURE_DENY_PASS");
}
const openWithSelection=(pilot,bearer,request)=>pilot.open(bearer,request);
