import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import {AccessDeniedError} from "@syndes/core-kernel";
import {OrganizationHost,OrganizationController} from "../dist/controller.js";

const tenant="11111111-1111-4111-8111-111111111111";
const orgA="22222222-2222-4222-8222-222222222222";
const orgB="33333333-3333-4333-8333-333333333333";
const actor={id:"44444444-4444-4444-8444-444444444444",kind:"user"};
const bearer="Bearer verified-by-keycloak";

function fixture(){
 const calls=[],rows=[{id:orgA,display_name:"A"},{id:orgB,display_name:"B"}];
 let allowB=false,alive=true;
 const core={
  kernel:{},
  verifier:{verify:async header=>{
   if(header!==bearer)throw Error("Invalid bearer");
   return actor;
  }},
  organizationAccess:{
   requireActive:async(t,o,p)=>{
    calls.push([t,o,p]);
    if(!alive||(o===orgB&&!allowB))throw new AccessDeniedError();
   },
  },
 };
 const host=new OrganizationHost(core,{resolve:async()=>{throw Error("No SQL lease expected")}});
 host.service.listOrganizations=async()=>rows;
 host.service.listWorkspaces=async()=>[{id:"workspaces-a"}];
 host.service.listUnits=async()=>[{id:"unit-a"}];
 for(const method of ["bootstrap","backfillDefaultOwnership","createOrganization","createWorkspace","createUnit"])
  host.service[method]=async()=>{throw Error("Untrusted SQL mutation must not execute")};
 return {host,controller:new OrganizationController(host),calls,
  permitB:()=>{allowB=true},outage:()=>{alive=false}};
}

test("multi-org directory hides SQL-member organizations after Keycloak membership revoke",async()=>{
 const prior=process.env.SYNDES_MULTI_ORG_ENABLED;
 process.env.SYNDES_MULTI_ORG_ENABLED="true";
 try{
  const f=fixture();
  assert.deepEqual(await f.controller.organizations(tenant,bearer),[{id:orgA,display_name:"A"}]);
  assert.deepEqual(f.calls,[[tenant,orgA,actor.id],[tenant,orgB,actor.id]]);
  f.permitB();
  assert.equal((await f.controller.organizations(tenant,bearer)).length,2);
  assert.deepEqual(await f.controller.workspaces(tenant,orgA,bearer),[{id:"workspaces-a"}]);
  await assert.rejects(f.controller.workspaces(tenant,orgA,"Bearer invalid"),
    error=>error.status===401);
  f.outage();
  await assert.rejects(f.controller.workspaces(tenant,orgA,bearer),
    error=>error.status===403);
  assert.deepEqual(await f.controller.organizations(tenant,bearer),[],
   "Keycloak outage must never leak an SQL-only directory");
 }finally{
  if(prior===undefined)delete process.env.SYNDES_MULTI_ORG_ENABLED;
  else process.env.SYNDES_MULTI_ORG_ENABLED=prior;
 }
});

test("multi-org SQL-only bootstrap, backfill and organization create are forbidden before mutation",async()=>{
 const prior=process.env.SYNDES_MULTI_ORG_ENABLED;
 process.env.SYNDES_MULTI_ORG_ENABLED="true";
 try{
  const f=fixture();
  for(const attempt of [
   ()=>f.controller.bootstrap(tenant,bearer,{organizationName:"A",workspaceName:"W"}),
   ()=>f.controller.backfill(tenant,bearer),
   ()=>f.controller.createOrganization(tenant,bearer,{displayName:"Orphan"}),
   ()=>f.controller.createWorkspace(tenant,orgB,bearer,{name:"W",slug:"w"}),
   ()=>f.controller.unit(tenant,orgB,bearer,{name:"HQ",kind:"headquarters"}),
  ])await assert.rejects(attempt(),error=>error.status===403);
  assert.equal(f.calls.length,2,
   "Only selected org-scoped methods consult Keycloak; unlinked creation is denied first");
 }finally{
  if(prior===undefined)delete process.env.SYNDES_MULTI_ORG_ENABLED;
  else process.env.SYNDES_MULTI_ORG_ENABLED=prior;
 }
});
