import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {TenantEventWorkerAdmission} from "../dist/platform-event-worker-admission.js";

const tenantId=randomUUID(),organizationId=randomUUID(),workspaceId=randomUUID();
const actor={kind:"service",id:"syndes-events-service"};
const request={
 actor,tenantId,organizationId,workspaceId,consumerId:"inbox.wa-received",
 moduleId:"inbox",eventType:"whatsapp.message.received.v2",
};
const gates=(state=true)=>{
 const calls={module:[],scope:[],grant:[]};
 const moduleAccess={canExecuteModule:async q=>{calls.module.push(q);return state}};
 const scope={active:async(...params)=>{calls.scope.push(params);return true}};
 const grant={canProcess:async q=>{calls.grant.push(q);return true}};
 return {calls,moduleAccess,scope,grant};
};
const make=(f)=>new TenantEventWorkerAdmission(
 f.moduleAccess,f.scope,f.grant,"syndes-events-service");

test("worker admission refuses implicit actors, injections and malformed event scope",async()=>{
 const f=gates();const admission=make(f);
 for(const invalid of [
  {...request,actor:{kind:"user",id:actor.id}},
  {...request,actor:{kind:"service",id:"forged-service"}},
  {...request,actor:{kind:"service",id:""}},
  {...request,tenantId:"../tenant"},
  {...request,organizationId:"not-a-uuid"},
  {...request,workspaceId:"other"},
  {...request,moduleId:"inbox;DROP"},
  {...request,consumerId:"crm.wa-received"},
  {...request,eventType:"unknown.event.v1"},
  {...request,workspaceId:null},
 ]){
  assert.equal(await admission.authorize(invalid),"denied");
 }
 assert.deepEqual(f.calls,{module:[],scope:[],grant:[]});
 for(const empty of [
  ()=>new TenantEventWorkerAdmission(undefined,f.scope,f.grant,actor.id),
  ()=>new TenantEventWorkerAdmission(f.moduleAccess,undefined,f.grant,actor.id),
  ()=>new TenantEventWorkerAdmission(f.moduleAccess,f.scope,undefined,actor.id),
  ()=>new TenantEventWorkerAdmission(f.moduleAccess,f.scope,f.grant,""),
 ]){
  assert.throws(empty,/Trusted/);
 }
});

test("ENABLED Control state required before tenant read and before FGA",async()=>{
 const f=gates(false),admission=make(f);
 assert.equal(await admission.authorize(request),"suspended");
 assert.equal(f.calls.module.length,1);
 assert.equal(f.calls.scope.length,0);
 assert.equal(f.calls.grant.length,0);
 assert.equal(f.calls.module[0].actor.kind,"service");
 assert.equal(f.calls.module[0].tenantId,tenantId);
 assert.equal(f.calls.module[0].moduleId,"inbox");
});

test("FGA service principal and exact tenant/org/workspace are forwarded unchanged",async()=>{
 const f=gates(),admission=make(f);
 assert.equal(await admission.authorize(request),"enabled");
 assert.deepEqual(f.calls.scope,[[tenantId,organizationId,workspaceId]]);
 assert.deepEqual(f.calls.grant,[request]);
 assert.equal(await admission.authorize({...request,workspaceId:null,eventType:"crm.person.created.v1"}),"enabled");
 assert.equal(f.calls.grant.at(-1).workspaceId,null);
});

test("Control, tenant scope or FGA outages suspend without faking success",async()=>{
 for(const key of ["moduleAccess","scope","grant"]){
  const f=gates();
  if(key==="moduleAccess")f.moduleAccess.canExecuteModule=async()=>{throw Error("down")};
  if(key==="scope")f.scope.active=async()=>{throw Error("down")};
  if(key==="grant")f.grant.canProcess=async()=>{throw Error("down")};
  assert.equal(await make(f).authorize(request),"suspended",key);
 }
});

test("missing organization/workspace or explicit FGA denial cannot be bypassed",async()=>{
 const f=gates();
 f.scope.active=async()=>false;
 assert.equal(await make(f).authorize(request),"denied");
 assert.equal(f.calls.grant.length,0);
 f.scope.active=async()=>true;
 f.grant.canProcess=async()=>false;
 assert.equal(await make(f).authorize(request),"denied");
});

test("authorization never grants access from frontend module flags or plain user claims",async()=>{
 const f=gates();
 assert.equal(await make(f).authorize({
  ...request,actor:{kind:"user",id:actor.id},
  clientEnabled:true,tenantDatabase:"postgres",permit:true,
 }),"denied");
 assert.equal(f.calls.module.length,0);
});
