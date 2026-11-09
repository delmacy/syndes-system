import test from "node:test";
import assert from "node:assert/strict";
import {CoreKernel,AccessDeniedError} from "@syndes/core-kernel";
import {WhatsAppDefaultContextGuard,whatsappScopedQuery} from "../dist/scope.js";
import {WhatsAppAccounts} from "../dist/accounts.js";

const tenant="11111111-1111-4111-8111-111111111111";
const otherTenant="22222222-2222-4222-8222-222222222222";
const org="33333333-3333-4333-8333-333333333333";
const ws="44444444-4444-4444-8444-444444444444";
const actor={id:"alice",kind:"user"};
async function fixture({tenantAllowed=true,fgaAllowed=true,rows=[{organization_id:org,workspace_id:ws}],dbTenant=tenant}={}){
 const resolved=[],queries=[],auth=[];
 const kernel=new CoreKernel({
  modules:[{id:"platform",version:"0.1.0"},{id:"whatsapp",version:"0.1.0",dependencies:["platform"]}],
  tenancy:{canAccessTenant:async q=>{auth.push(["tenant",q]);return tenantAllowed}},
  authorization:{canAccess:async q=>{auth.push(["fga",q]);return fgaAllowed}}
 });
 await kernel.start();
 const guard=new WhatsAppDefaultContextGuard(kernel,{
  resolve:async t=>{
   resolved.push(t);
   return {tenantId:dbTenant,query:async(sql,params)=>{queries.push({sql,params});return {rows,rowCount:rows.length}}};
  }
 });
 return {guard,resolved,queries,auth};
}
test("WhatsApp human account context validates tenant + FGA before any tenant DB lease",async()=>{
 const absent=await fixture({tenantAllowed:false});
 await assert.rejects(absent.guard.resolve(tenant,actor),AccessDeniedError);
 assert.deepEqual(absent.resolved,[]);
 const fga=await fixture({fgaAllowed:false});
 await assert.rejects(fga.guard.resolve(tenant,actor),AccessDeniedError);
 assert.deepEqual(fga.resolved,[]);
 assert.equal(fga.auth[1][1].resource,"whatsapp:accounts");
 assert.equal(fga.auth[1][1].action,"read");
});
test("WhatsApp default guard requires active org/workspace, backfill and SQL single-context gate",async()=>{
 const f=await fixture();
 assert.deepEqual(await f.guard.resolve(tenant,actor),{tenantId:tenant,organizationId:org,workspaceId:ws});
 assert.deepEqual(f.queries[0].params,[tenant,actor.id]);
 assert.match(f.queries[0].sql,/om.state='active'/);
 assert.match(f.queries[0].sql,/wm.state='active'/);
 assert.match(f.queries[0].sql,/platform_legacy_backfill_runs/);
 assert.match(f.queries[0].sql,/platform_legacy_single_organization/);
 assert.match(f.queries[0].sql,/platform_legacy_single_workspace/);
 const missing=await fixture({rows:[]});
 await assert.rejects(missing.guard.resolve(tenant,actor),AccessDeniedError);
 const wrong=await fixture({dbTenant:otherTenant});
 await assert.rejects(wrong.guard.resolve(tenant,actor),/Tenant database mismatch/);
 assert.deepEqual(wrong.queries,[]);
});
test("WhatsApp SQL scope placeholders are bound and reject missing org/workspace predicates",async()=>{
 const queries=[];
 const db={query:async(sql,params)=>{queries.push({sql,params});return {rows:[]}}};
 await whatsappScopedQuery(db,{tenantId:tenant,organizationId:org,workspaceId:ws},
  "SELECT 1 WHERE tenant_id=$1::uuid /*WSCOPE:AND org=@@ORG@@ AND ws=@@WS@@*/",[tenant]);
 assert.deepEqual(queries[0].params,[tenant,org,ws]);
 assert.match(queries[0].sql,/org=\$2::uuid AND ws=\$3::uuid/);
 assert.doesNotMatch(queries[0].sql,new RegExp(org));
 assert.throws(()=>whatsappScopedQuery(db,{tenantId:tenant,organizationId:org,workspaceId:ws},"SELECT 1",[]),/lacks organization\/workspace/);
 assert.throws(()=>whatsappScopedQuery(db,{tenantId:tenant,organizationId:org,workspaceId:""},"SELECT 1 /*WSCOPE:AND org=@@ORG@@ AND ws=@@WS@@*/",[]),/Invalid trusted WhatsApp scope/);
 assert.equal(queries.length,1);
});
test("account CRUD always binds verified organization with scope, rejects foreign account",async()=>{
 const qs=[],accountId="55555555-5555-4555-8555-555555555555";
 const db={query:async(sql,params)=>{qs.push({sql,params});return {rows:[]}}};
 const service=new WhatsAppAccounts(async()=>db);
 const scope={tenantId:tenant,organizationId:org,workspaceId:ws};
 await service.list(scope);
 await service.get(scope,accountId);
 await service.setEnabled(scope,accountId,false);
 assert.deepEqual(qs[0].params,[tenant,org]);
 assert.match(qs[0].sql,/platform_organization_id=\$2::uuid/);
 assert.deepEqual(qs[1].params,[tenant,accountId,org]);
 assert.match(qs[1].sql,/platform_organization_id=\$3::uuid/);
 assert.deepEqual(qs[2].params,[tenant,accountId,false,org]);
 assert.match(qs[2].sql,/platform_organization_id=\$4::uuid/);
 await assert.rejects(service.list({tenantId:tenant,organizationId:org}),/Invalid trusted WhatsApp scope/);
 assert.equal(qs.length,3,"Incomplete scope denied before tenant SQL");
});

test("the multi-org switch rejects legacy tenant-only WhatsApp accounts before SQL",async()=>{
 const prior=process.env.SYNDES_MULTI_ORG_ENABLED;
 process.env.SYNDES_MULTI_ORG_ENABLED="true";
 try{
  let leases=0;
  const service=new WhatsAppAccounts(async()=>{leases++;throw Error("Should not open tenant DB")});
  await assert.rejects(service.list({tenantId:tenant}),/Unscoped WhatsApp account access prohibited/);
  await assert.rejects(service.get({tenantId:tenant},"55555555-5555-4555-8555-555555555555"),/Unscoped WhatsApp account access prohibited/);
  assert.equal(leases,0);
 }finally{
  if(prior===undefined)delete process.env.SYNDES_MULTI_ORG_ENABLED;
  else process.env.SYNDES_MULTI_ORG_ENABLED=prior;
 }
});
