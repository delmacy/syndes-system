import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {FirstTenantSignupSaga} from "../dist/signup-first-tenant-saga.js";

const input=()=>({requestId:randomUUID(),founderId:randomUUID(),
 accountName:"Syndes Customer",organizationName:"My Business",
 workspaceName:"Operations"});
function fixture(fail=""){
 const req=input(),kcId=randomUUID(),events=[];
 let state="reserved",member=true,grant=true,db=false,context=false,
  active=false,linked=false,lock=false,revisions=1;
 const intent={...req,tenantId:randomUUID(),organizationId:randomUUID(),
  workspaceId:randomUUID(),keycloakAlias:"syndes-test-alias",
  keycloakOrganizationId:null,state,revision:revisions};
 const blocked=(key)=>{if(key===fail)throw Error("Injected provider failure: "+key)};
 const ports={
  authorizeOperator:async x=>x.founderId===req.founderId,
  withRequestLock:async(_,work)=>{if(lock)throw Error("Concurrent lock denied");
   lock=true;try{return await work(async()=>{if(!lock)throw Error('Lock lost')})}finally{lock=false}},
  intents:{
   reserve:async x=>{
    events.push("reserve");
    if(JSON.stringify(x)!==JSON.stringify(req))throw Error("Foreign/altered reservation");
    return {...intent,state,keycloakOrganizationId:intent.keycloakOrganizationId,revision:revisions};
   },
   get:async()=>({...intent,state,keycloakOrganizationId:intent.keycloakOrganizationId}),
   markReady:async(_,__,id)=>{events.push("ready");blocked("markReady");
     if(state==="ready"&&intent.keycloakOrganizationId!==id)throw Error("conflict");
     state="ready";intent.keycloakOrganizationId=id;revisions++},
   markReconcileRequired:async()=>{events.push("reconcile");
      if(state!=="ready")state="reconcile_required"},
  },
  installer:{
   ensureDatabase:async()=>{events.push("database");blocked("database");db=true},
   verifyDatabase:async()=>db,
   ensureDefaultContext:async()=>{events.push("context");blocked("context");context=true},
   verifyDefaultContext:async()=>context,
   activate:async()=>{events.push("activate");blocked("activate");active=true},
   verifyActive:async()=>active,
  },
  keycloak:{
   ensureOrganization:async()=>{events.push("kc-org");blocked("kc-org");return kcId},
   ensureMember:async()=>{events.push("kc-member");blocked("kc-member");member=true},
   isActiveMember:async()=>member,
  },
  links:{
   ensure:async()=>{events.push("link");blocked("link");linked=true},
   verify:async()=>linked,
  },
  grants:{
   ensureMinimum:async()=>{events.push("grant");blocked("grant");grant=true},
   verifyMinimum:async()=>grant,
  },
 };
 const saga=new FirstTenantSignupSaga(ports);
 return {req,events,ports,saga,revokeMember:()=>{member=false},
  revokeGrant:()=>{grant=false},setFail:()=>{},
  state:()=>state,resources:()=>({db,context,active,linked,grant})};
}
test("UC-SIGNUP-01C establishes one first tenant, and ready replay never regrants",async()=>{
 const x=fixture();
 const ready=await x.saga.resume(x.req);
 assert.equal(ready.ready,true);
 assert.equal(ready.tenantId.length,36);
 assert.deepEqual(await x.saga.resume(x.req),ready);
 assert.equal(x.events.filter(y=>y==="database").length,1);
 assert.equal(x.events.filter(y=>y==="kc-member").length,1);
 assert.equal(x.events.filter(y=>y==="grant").length,1);
 x.revokeMember();
 await assert.rejects(x.saga.resume(x.req));
 assert.equal(x.events.filter(y=>y==="kc-member").length,1,
  "READY retry must never rejoin a revoked Keycloak Organization");
 assert.equal(x.events.filter(y=>y==="grant").length,1);
});
test("UC-SIGNUP-01C FGA revocation after ready never regrants",async()=>{
 const x=fixture();await x.saga.resume(x.req);
 x.revokeGrant();
 await assert.rejects(x.saga.resume(x.req));
 assert.equal(x.events.filter(y=>y==="grant").length,1);
});
test("UC-SIGNUP-01C operator and request ownership reject before any provider",async()=>{
 const x=fixture();
 await assert.rejects(x.saga.resume({...x.req,founderId:randomUUID()}));
 assert.deepEqual(x.events,[]);
 await assert.rejects(x.saga.resume({...x.req,accountName:"Other"}));
 assert.deepEqual(x.events,["reserve"]);
});
for(const failure of ["database","kc-org","kc-member","context","link","grant","activate","markReady"]){
 test("UC-SIGNUP-01C failure at "+failure+" is reconcile_required and never READY",async()=>{
  const x=fixture(failure);
  await assert.rejects(x.saga.resume(x.req));
  assert.equal(x.state(),"reconcile_required");
  assert.ok(x.events.includes("reconcile"));
  assert.ok(!x.events.includes("ready")||failure==="markReady");
 });
}
test("UC-SIGNUP-01C provider verify=false denies ready even if ensure reports success",async()=>{
 const x=fixture();
 x.ports.grants.verifyMinimum=async()=>false;
 await assert.rejects(x.saga.resume(x.req));
 assert.equal(x.state(),"reconcile_required");
 assert.ok(!x.events.includes("ready"));
});
test("UC-SIGNUP-01C request-scoped serialization rejects concurrent retry",async()=>{
 const x=fixture();
 let resume;let mark;
 const hold=new Promise(resolve=>{mark=resolve});
 const prior=x.ports.installer.ensureDatabase;
 x.ports.installer.ensureDatabase=async intent=>{
  resume?.();await hold;return prior(intent);
 };
 const first=x.saga.resume(x.req);
 await new Promise(resolve=>{resume=resolve});
 await assert.rejects(x.saga.resume(x.req),/Concurrent lock denied/);
 mark();
 assert.equal((await first).ready,true);
 assert.equal(x.events.filter(y=>y==="grant").length,1);
});
