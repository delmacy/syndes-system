import test from "node:test";
import assert from "node:assert/strict";
import {CoreKernel} from "@syndes/core-kernel";
import {CrmService,CrmExtras} from "../dist/index.js";
const tenant="11111111-1111-4111-8111-111111111111";
const organization="22222222-2222-4222-8222-222222222222";
const context={tenantId:tenant,actor:{id:"agent",kind:"user"},organizationId:organization,
 workspaceId:"33333333-3333-4333-8333-333333333333"};
test("CRM domain services forward only trusted organization context into repository factories",async()=>{
 const calls=[];
 const kernel=new CoreKernel({
  modules:[{id:"platform",version:"0.1.0"},{id:"crm",version:"0.1.0",dependencies:["platform"]}],
  tenancy:{canAccessTenant:async()=>true},
  authorization:{canAccess:async()=>true},
 });
 await kernel.start();
 const crm=new CrmService(kernel,async(t,o)=>{
  calls.push(["crm",t,o]);
  return {getPerson:async()=>null};
 });
 const extras=new CrmExtras(kernel,async(t,o)=>{
  calls.push(["extras",t,o]);
  return {listExportPeople:async()=>[]};
 });
 assert.equal(await crm.getPerson(context,"44444444-4444-4444-8444-444444444444"),null);
 assert.equal(typeof await extras.exportCsv(context),"string");
 assert.deepEqual(calls,[["crm",tenant,organization],["extras",tenant,organization]]);
});
