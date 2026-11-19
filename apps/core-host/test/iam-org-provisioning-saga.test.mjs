import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {AccessDeniedError} from "@syndes/core-kernel";
import {OrganizationProvisioningSaga} from "../dist/iam-org-provisioning-operator.js";

const input=()=>({
 requestId:randomUUID(),tenantId:randomUUID(),founderId:randomUUID(),
 organizationName:"Acme Serviços",workspaceName:"Atendimento",
});
function fixture(){
 const original=input(),K=randomUUID();
 const values={
  ...original,organizationId:randomUUID(),workspaceId:randomUUID(),
  keycloakAlias:"syndes-"+original.tenantId.replaceAll("-","")+"-"+
    original.requestId.replaceAll("-",""),
  keycloakOrganizationId:null,state:"reserved",revision:1,
 };
 const counters={reserves:0,keycloak:0,member:0,tenant:0,link:0,ready:0,
  status:0,operator:0,tenantAdmin:0};
 let fail="",member=false,orgCreated=false,tenantCreated=false,linkCreated=false,authorized=true;
 const ports={
  authorizeOperator:async()=>{counters.operator++;return authorized;},
  intents:{
   reserve:async request=>{
    counters.reserves++;
    if(request.requestId!==original.requestId||
     request.organizationName!==original.organizationName||
     request.tenantId!==original.tenantId||
     request.founderId!==original.founderId)throw new AccessDeniedError();
    return {...values};
   },
   bindKeycloak:async(requestId,id)=>{
    assert.equal(requestId,values.requestId);
    assert.equal(id,K);
    if(fail==="bind")throw Error("Control timeout");
    values.keycloakOrganizationId=id;
   },
   markReady:async(requestId,id)=>{
    assert.equal(requestId,values.requestId);
    assert.equal(id,K);
    if(!linkCreated||!member||!tenantCreated)throw Error("Not ready");
    counters.ready++;values.state="ready";
   },
   markReconcileRequired:async()=>{
    if(values.state!=="ready")values.state="reconcile_required";
    counters.status++;
   },
  },
  keycloak:{
   ensureOrganization:async(alias,name)=>{
    counters.keycloak++;
    assert.equal(alias,values.keycloakAlias);
    assert.equal(name,values.organizationName);
    orgCreated=true;
    if(fail==="keycloak")throw Error("201 then lost TCP response");
    return K;
   },
   ensureMember:async(k,id)=>{
    assert.equal(k,K);
    assert.equal(id,values.founderId);
    counters.member++;if(fail==="membership")throw Error("Keycloak down");
    member=true;
   },
   isActiveMember:async()=>member,
  },
  tenant:{
   founderIsAdmin:async()=>{counters.tenantAdmin++;return authorized;},
   ensure:async()=>{
    counters.tenant++;
    if(fail==="tenant")throw Error("Tenant PG down");
    tenantCreated=true;
   },
   verify:async()=>tenantCreated,
  },
  links:{
   ensure:async()=>{
    counters.link++;
    if(fail==="controlLink")throw Error("Control link down");
    linkCreated=true;
   },
   verify:async()=>linkCreated,
  },
 };
 return {
  input:original,counters,values,K,ports,
  saga:new OrganizationProvisioningSaga(ports),
  failAt:name=>{fail=name},
  setAuthorized:x=>{authorized=x},
  revokeMember:()=>{member=false},
  state:()=>({orgCreated,tenantCreated,linkCreated,member}),
 };
}
test("operator saga creates exactly one org/workspace/Keycloak link and is idempotent",async()=>{
 const f=fixture();
 const first=await f.saga.resume(f.input);
 assert.deepEqual(first,{ready:true,requestId:f.input.requestId,
  organizationId:f.values.organizationId,workspaceId:f.values.workspaceId,
  keycloakOrganizationId:f.K});
 assert.equal(f.values.state,"ready");
 assert.equal(f.counters.ready,1);
 const second=await f.saga.resume(f.input);
 assert.deepEqual(second,first);
 assert.equal(f.counters.ready,1);
 assert.equal(f.counters.keycloak,1);
 assert.equal(f.counters.member,1);
 assert.equal(f.counters.tenant,1);
 assert.equal(f.counters.link,1);
});
test("Keycloak 201 then TCP outage preserves durable intent; retry reconciles same IDs",async()=>{
 const f=fixture();
 f.failAt("keycloak");
 await assert.rejects(f.saga.resume(f.input),AccessDeniedError);
 assert.equal(f.values.state,"reconcile_required");
 assert.equal(f.state().orgCreated,true);
 assert.equal(f.values.organizationId.length,36);
 f.failAt("");
 const fixed=await f.saga.resume(f.input);
 assert.equal(fixed.organizationId,f.values.organizationId);
 assert.equal(fixed.keycloakOrganizationId,f.K);
 assert.equal(f.values.state,"ready");
});
test("partial tenant or Control-link failures never turn READY and retries reconcile",async()=>{
 for(const point of ["bind","membership","tenant","controlLink"]){
  const f=fixture();
  f.failAt(point);
  await assert.rejects(f.saga.resume(f.input),AccessDeniedError);
  assert.notEqual(f.values.state,"ready",point);
  f.failAt("");
  assert.equal((await f.saga.resume(f.input)).ready,true,point);
  assert.equal(f.counters.ready,1);
 }
});
test("revocation after READY cannot be undone by duplicate signup or operator retry",async()=>{
 const f=fixture();
 await f.saga.resume(f.input);
 f.revokeMember();
 await assert.rejects(f.saga.resume(f.input),AccessDeniedError);
 assert.equal(f.counters.member,1,
  "A completed organization must never silently re-grant revoked membership");
 assert.equal(f.values.state,"ready",
  "Do not change the historical completed intent while live access is revoked");
});
test("nonoperator, revoked tenant founder and modified retry input deny BEFORE external KC",async()=>{
 const f=fixture();
 f.setAuthorized(false);
 await assert.rejects(f.saga.resume(f.input),AccessDeniedError);
 assert.equal(f.counters.reserves,0);
 assert.equal(f.counters.keycloak,0);
 f.setAuthorized(true);
 await assert.rejects(f.saga.resume({...f.input,organizationName:"Changed"}),AccessDeniedError);
 assert.equal(f.counters.keycloak,0);
 for(const v of [{...f.input,founderId:"attacker"}, {...f.input,workspaceName:""}])
  await assert.rejects(f.saga.resume(v),AccessDeniedError);
 assert.equal(f.counters.keycloak,0);
});
