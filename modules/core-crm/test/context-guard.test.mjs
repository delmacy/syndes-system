import test from "node:test";
import assert from "node:assert/strict";
import {AccessDeniedError,CoreKernel} from "@syndes/core-kernel";
import {CrmDefaultContextGuard} from "../dist/context-guard.js";
import {TenantDatabaseMismatchError} from "../dist/contracts.js";

const tenant="4ab44379-d557-4df6-a2be-d44e121a8077";
const other="d21930aa-f4f6-40c0-bb1a-e71d7bb92caa";
const org="33333333-3333-4333-8333-333333333333";
const ws="44444444-4444-4444-8444-444444444444";
const alice={id:"alice",kind:"user"};
async function fake({
 member=true,allowed=true,rows=[{organization_id:org,workspace_id:ws}],
 dbTenant=tenant,enforce=false,enabled=true,throwOnGate=false,withPort=true
}={}){
 const calls=[],queries=[],resolved=[];
 const kernel=new CoreKernel({
  modules:[{id:"platform",version:"0.1.0"},{id:"crm",version:"0.1.0",dependencies:["platform"]}],
  tenancy:{canAccessTenant:async q=>{calls.push(["tenancy",q]);return member}},
  authorization:{canAccess:async q=>{calls.push(["fga",q]);return allowed}},
  moduleAccess:withPort?{canExecuteModule:async q=>{
    calls.push(["module",q]);
    if(throwOnGate)throw Error("Control DB unavailable");
    return enabled;
  }}:undefined,
 });
 await kernel.start();
 const guard=new CrmDefaultContextGuard(kernel,{
  resolve:async t=>{
   resolved.push(t);
   return {tenantId:dbTenant,query:async(sql,params)=>{
    queries.push({sql,params});return {rows,rowCount:rows.length};
   }};
  }
 },enforce);
 return {guard,calls,queries,resolved};
}
test("CRM FGA and verified tenant membership execute before ANY DB resolution",async()=>{
 const denied=await fake({member:false});
 await assert.rejects(denied.guard.resolve(tenant,alice),AccessDeniedError);
 assert.deepEqual(denied.resolved,[]);
 assert.equal(denied.calls.length,1);
 const fgaDenied=await fake({allowed:false});
 await assert.rejects(fgaDenied.guard.resolve(tenant,alice),AccessDeniedError);
 assert.deepEqual(fgaDenied.resolved,[]);
 assert.equal(fgaDenied.calls[1][1].resource,"crm:context");
 assert.equal(fgaDenied.calls[1][1].action,"read");
});
test("CRM guard fails closed on wrong tenant DB, missing default or unbackfilled membership",async()=>{
 const wrong=await fake({dbTenant:other});
 await assert.rejects(wrong.guard.resolve(tenant,alice),TenantDatabaseMismatchError);
 assert.deepEqual(wrong.queries,[]);
 const noContext=await fake({rows:[]});
 await assert.rejects(noContext.guard.resolve(tenant,alice),AccessDeniedError);
 assert.equal(noContext.queries.length,1);
});
test("CRM guard returns ONLY SQL-verified default org and workspace",async()=>{
 const f=await fake();
 const s=await f.guard.resolve(tenant,alice);
 assert.deepEqual(s,{tenantId:tenant,actor:alice,organizationId:org,workspaceId:ws});
 assert.equal(f.queries.length,1);
 const q=f.queries[0];
 assert.deepEqual(q.params,[tenant,"alice"]);
 assert.match(q.sql,/platform_org_memberships om/);
 assert.match(q.sql,/platform_workspace_memberships wm/);
 assert.match(q.sql,/om\.state='active'/);
 assert.match(q.sql,/wm\.state='active'/);
 assert.match(q.sql,/platform_legacy_backfill_runs/);
 assert.match(q.sql,/platform_legacy_single_organization/);
 assert.match(q.sql,/platform_legacy_single_workspace/);
 assert.doesNotMatch(q.sql,/alice|Bearer/);
});

test("CRM enforced entry validates membership → FGA → ENABLED module BEFORE tenant DB",async()=>{
 const f=await fake({enforce:true});
 const ctx=await f.guard.resolve(tenant,alice);
 assert.equal(ctx.organizationId,org);
 assert.deepEqual(f.calls.map(([type])=>type),["tenancy","fga","module"]);
 assert.deepEqual(f.calls.at(-1)[1],{actor:alice,tenantId:tenant,moduleId:"crm"});
 assert.equal(f.resolved.length,1);
});

test("CRM denies disabled, missing gate and Control DB error before tenant DB",async()=>{
 for(const options of [
  {enforce:true,enabled:false},{enforce:true,withPort:false},{enforce:true,throwOnGate:true},
 ]){
  const f=await fake(options);
  await assert.rejects(f.guard.resolve(tenant,alice),AccessDeniedError);
  assert.deepEqual(f.resolved,[]);
  assert.deepEqual(f.queries,[]);
 }
});

test("CRM never queries Control state when membership/FGA denies",async()=>{
 for(const options of [{enforce:true,member:false},{enforce:true,allowed:false}]){
  const f=await fake(options);
  await assert.rejects(f.guard.resolve(tenant,alice),AccessDeniedError);
  assert.deepEqual(f.resolved,[]);
  assert.equal(f.calls.some(([kind])=>kind==="module"),false);
 }
});

test("CRM rollout defaults to legacy and keeps existing guarded route behavior",async()=>{
 const f=await fake();
 const ctx=await f.guard.resolve(tenant,alice);
 assert.equal(ctx.tenantId,tenant);
 assert.deepEqual(f.calls.map(([type])=>type),["tenancy","fga"]);
 assert.equal(f.resolved.length,1);
});
