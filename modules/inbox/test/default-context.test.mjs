import test from "node:test";
import assert from "node:assert/strict";
import {CoreKernel,AccessDeniedError} from "@syndes/core-kernel";
import {InboxDefaultContextGuard} from "../dist/context-guard.js";
import {InboxTenantMismatchError,InboxValidationError} from "../dist/contracts.js";
import {InboxService} from "../dist/service.js";
import {InboxChangeBus} from "../dist/realtime.js";
const tenant="11111111-1111-4111-8111-111111111111";
const different="22222222-2222-4222-8222-222222222222";
const org="33333333-3333-4333-8333-333333333333";
const workspace="44444444-4444-4444-8444-444444444444";
const actor={id:"alice",kind:"user"};
async function prepare({member=true,allowed=true,rows=[{organization_id:org,workspace_id:workspace}],leaseTenant=tenant}={}){
 const auth=[],resolutions=[],queries=[];
 const kernel=new CoreKernel({
  modules:[{id:"platform",version:"0.1.0"},{id:"crm",version:"0.1.0",dependencies:["platform"]},{id:"inbox",version:"0.1.0",dependencies:["platform","crm"]}],
  tenancy:{canAccessTenant:async q=>{auth.push(["tenant",q]);return member}},
  authorization:{canAccess:async q=>{auth.push(["fga",q]);return allowed}},
 });
 await kernel.start();
 const guard=new InboxDefaultContextGuard(kernel,{
  resolve:async id=>{
   resolutions.push(id);
   return {tenantId:leaseTenant,query:async (sql,params)=>{queries.push({sql,params});return {rows,rowCount:rows.length}}};
  },
 });
 return {guard,auth,resolutions,queries};
}
test("default Inbox context requires tenant membership AND Inbox FGA before DB lease",async()=>{
 const denied=await prepare({member:false});
 await assert.rejects(denied.guard.resolve(tenant,actor),AccessDeniedError);
 assert.deepEqual(denied.resolutions,[]);
 const deniedFga=await prepare({allowed:false});
 await assert.rejects(deniedFga.guard.resolve(tenant,actor),AccessDeniedError);
 assert.deepEqual(deniedFga.resolutions,[]);
 assert.equal(deniedFga.auth[1][1].resource,"inbox:conversations");
 assert.equal(deniedFga.auth[1][1].action,"read");
});
test("default Inbox context denies nonmembers, incomplete backfill and removed 002 guard",async()=>{
 const absent=await prepare({rows:[]});
 await assert.rejects(absent.guard.resolve(tenant,actor),AccessDeniedError);
 const mismatched=await prepare({leaseTenant:different});
 await assert.rejects(mismatched.guard.resolve(tenant,actor),InboxTenantMismatchError);
 assert.deepEqual(mismatched.queries,[]);
 const okay=await prepare();
 const result=await okay.guard.resolve(tenant,actor);
 assert.deepEqual(result,{tenantId:tenant,actor,organizationId:org,workspaceId:workspace});
 const {sql,params}=okay.queries[0];
 assert.deepEqual(params,[tenant,actor.id]);
 assert.match(sql,/platform_org_memberships/);
 assert.match(sql,/platform_workspace_memberships/);
 assert.match(sql,/om\.state='active'/);
 assert.match(sql,/wm\.state='active'/);
 assert.match(sql,/platform_legacy_backfill_runs/);
 assert.match(sql,/platform_legacy_single_organization/);
 assert.match(sql,/platform_legacy_single_workspace/);
});
test("SSE isolation separates tenants, organizations and workspaces, including legacy events",()=>{
 const bus=new InboxChangeBus();
 const a={tenantId:tenant,organizationId:org,workspaceId:workspace};
 const b={tenantId:tenant,organizationId:different,workspaceId:workspace};
 const c={tenantId:tenant,organizationId:org,workspaceId:different};
 const calls={a:0,b:0,c:0,legacy:0};
 const offs=[
  bus.subscribe(a,()=>calls.a++),
  bus.subscribe(b,()=>calls.b++),
  bus.subscribe(c,()=>calls.c++),
  bus.subscribe(tenant,()=>calls.legacy++),
 ];
 bus.publish(a);
 assert.deepEqual(calls,{a:1,b:0,c:0,legacy:0});
 bus.publish(b);bus.publish(c);
 assert.deepEqual(calls,{a:1,b:1,c:1,legacy:0});
 bus.publish(tenant);
 assert.deepEqual(calls,{a:1,b:1,c:1,legacy:1});
 assert.throws(()=>bus.publish({tenantId:tenant}),/Verified Inbox event scope/);
 offs.forEach(fn=>fn());
 assert.equal(bus.count(a),0);
});

test("incomplete or empty trusted service scope cannot fall back to tenant-only SQL",()=>{
 let resolved=0;
 const service=new InboxService({execute:async (_q,handler)=>handler()},
  async()=>{resolved++;throw Error("Must not resolve DB");});
 for(const parts of [
  {organizationId:org},
  {organizationId:org,workspaceId:""},
  {organizationId:"",workspaceId:""},
  {workspaceId:workspace},
 ]){
  assert.throws(()=>service.list({tenantId:tenant,actor,...parts}),/Incomplete Inbox organization\/workspace/);
 }
 assert.equal(resolved,0);
});

test("workspace transfers reject missing trusted scope before resolving a tenant database",()=>{
 let leases=0;
 const service=new InboxService({execute:async (_q,handler)=>handler()},
  async()=>{leases++;throw Error("tenant database should never be resolved")});
 assert.throws(()=>service.transferWorkspace({tenantId:tenant,actor},"22222222-2222-4222-8222-222222222222",workspace),
   /requires an authorized context/);
 assert.equal(leases,0);
});
test("workspace transfer requires inbox assignment write grant before database resolution",async()=>{
 const auth=[];
 const kernel={execute:async (q,handler)=>{
   auth.push(q);
   if(q.resource==="inbox:assignment"&&q.action==="write")throw new AccessDeniedError();
   return handler();
 }};
 let leases=0;
 const service=new InboxService(kernel,async()=>{
   leases++;throw Error("tenant database should never be resolved");
 });
 await assert.rejects(service.transferWorkspace({tenantId:tenant,actor,
   organizationId:org,workspaceId:workspace},"22222222-2222-4222-8222-222222222222",
   "55555555-5555-4555-8555-555555555555"),AccessDeniedError);
 assert.equal(leases,0);
 assert.equal(auth[0].resource,"inbox:assignment");
});
