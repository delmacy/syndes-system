import assert from "node:assert/strict";
import test from "node:test";
import {Iam07SseSessionPilot} from "../dist/iam07-sse-session-pilot.js";
import {pilotResourceName} from "../dist/keycloak-authorization-pilot.js";

const t="11111111-1111-4111-8111-111111111111";
const o="22222222-2222-4222-8222-222222222222";
const w="44444444-4444-4444-8444-444444444444";
const kc="55555555-5555-4555-8555-555555555555";
const actor="66666666-6666-4666-8666-666666666666";
const bearer="Bearer header.payload.signature";
const req={tenantId:t,organizationId:o,workspaceId:w,capability:"inbox.conversation.read"};
const context=Object.freeze({
 actor:Object.freeze({kind:"user",id:actor}),
 tenantId:t,organizationId:o,workspaceId:w,keycloakOrganizationId:kc,
 realm:"syndes-iam-lab-ci",capability:req.capability,moduleId:"inbox",
 resourceName:pilotResourceName({tenantId:t,organizationId:o,workspaceId:w,kind:"workspace"}),
 scopeWriteAllowed:false,
});

test("IAM-07 stream only opens after verified read admission and FGA allow",async()=>{
 const checks=[];
 const requested=[];
 const session=new Iam07SseSessionPilot({
  resolve:async(token,selection)=>{
   assert.equal(token,bearer);
   requested.push(selection);
   return context;
  },
 },{canAccess:async q=>{checks.push(q);return true;}});
 const open=await session.open(bearer,{...req});
 assert.deepEqual(open.address,{tenantId:t,organizationId:o,workspaceId:w});
 assert.equal(Object.isFrozen(open.address),true);
 assert.equal(await open.revalidate(),true);
 assert.equal(requested.length,2);
 assert.equal(Object.isFrozen(requested[0]),true);
 assert.deepEqual(checks,[{
  actor:context.actor,tenantId:t,resource:"inbox:conversations",action:"read",
 },{
  actor:context.actor,tenantId:t,resource:"inbox:conversations",action:"read",
 }]);
});
test("IAM-07 denies wrong capability/funnel, token and scope before calling sources",async()=>{
 let count=0;
 const gate=new Iam07SseSessionPilot({
  resolve:async()=>{count++;return context;}
 },{canAccess:async()=>true});
 for(const [token,selection] of [
  ["bad",req],[bearer,{...req,capability:"inbox.message.send"}],
  [bearer,{...req,capability:"inbox.conversation.claim"}],
  [bearer,{...req,organizationId:"bad"}],
  [bearer,{...req,funnelId:actor}],
 ]){
  await assert.rejects(gate.open(token,selection),/denied/);
 }
 assert.equal(count,0);
});
test("IAM-07 rechecks the original immutable selection and rejects live changes",async()=>{
 let current=context,allowed=true,fail=false;
 const seen=[];
 const gate=new Iam07SseSessionPilot({
  resolve:async(_,q)=>{seen.push(q);
   if(fail)throw Error("Keycloak member revoked or Control/PG outage");
   return current;},
 },{canAccess:async()=>allowed});
 const caller={...req};
 const session=await gate.open(bearer,caller);
 caller.workspaceId=actor;
 assert.equal(await session.revalidate(),true);
 assert.equal(seen[1].workspaceId,w);
 allowed=false;
 assert.equal(await session.revalidate(),false,"FGA deny prevails");
 allowed=true;
 current=Object.freeze({...context,actor:Object.freeze({kind:"user",id:kc})});
 assert.equal(await session.revalidate(),false,"cannot replace the signed principal");
 current=Object.freeze({...context,keycloakOrganizationId:actor});
 assert.equal(await session.revalidate(),false,"cannot silently relink Keycloak Organization");
 current=Object.freeze({...context,workspaceId:actor});
 assert.equal(await session.revalidate(),false,"cannot switch workspace");
 current=context;
 fail=true;
 assert.equal(await session.revalidate(),false,"provider outage denies");
});
test("IAM-07 FGA initial outage or denial cannot open a live stream",async()=>{
 for(const impl of [async()=>false,async()=>{throw Error("FGA unavailable");}]){
  const gate=new Iam07SseSessionPilot({resolve:async()=>context},{canAccess:impl});
  await assert.rejects(gate.open(bearer,req),/admission denied/);
 }
});
test("IAM-07 malformed or mismatched admission cannot borrow valid FGA",async()=>{
 let fgaCalls=0;
 for(const returned of [
  {...context,moduleId:"crm"},{...context,capability:"inbox.message.send"},
  {...context,actor:{kind:"service",id:actor}},{...context,tenantId:actor},
  {...context,organizationId:actor},
 ]){
  const gate=new Iam07SseSessionPilot(
    {resolve:async()=>returned},{canAccess:async()=>{fgaCalls++;return true;}});
  await assert.rejects(gate.open(bearer,req),/denied/);
 }
 assert.equal(fgaCalls,0);
});
