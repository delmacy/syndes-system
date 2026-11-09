import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import {NestFactory} from "@nestjs/core";
import {Module,Global} from "@nestjs/common";
import {CoreKernel} from "@syndes/core-kernel";
import {loadInstalledPlugins,installModuleAssets} from "../dist/module-host.js";
const A="4ab44379-d557-4df6-a2be-d44e121a8077";
const B="d21930aa-f4f6-40c0-bb1a-e71d7bb92caa";

test("Inbox HTTP routes mount without Host-specific business controllers and deny before tenant DB",async()=>{
 const plugins=await loadInstalledPlugins();
 const kernel=new CoreKernel({
  modules:[{id:"platform",version:"0.1.0"},...plugins.map(p=>p.definition)],
  tenancy:{canAccessTenant:async({actor,tenantId})=>actor.id==="agent"&&tenantId===A},
  authorization:{canAccess:async({resource,action})=>resource.startsWith("inbox:")&&["read","write"].includes(action)}
 });
 await kernel.start();
 let resolutions=0;
 const provider={resolve:async tenantId=>{
  resolutions++;return {tenantId,query:async sql=>sql.includes('FROM platform_organizations o')
    ? {rows:[{organization_id:'33333333-3333-4333-8333-333333333333',workspace_id:'44444444-4444-4444-8444-444444444444'}],rowCount:1}
    : {rows:[],rowCount:0}};
 }};
 class Runtime{}
 Global()(Runtime);
 Module({providers:[{provide:"SYNDES_CORE_API",useValue:{kernel,verifier:{
  verify:async header=>{if(header!=="Bearer inbox-ci")throw Error("Unauthenticated");return {id:"agent",kind:"user"}}
 }}},{provide:"SYNDES_TENANT_DB",useValue:provider}],
 exports:["SYNDES_CORE_API","SYNDES_TENANT_DB"]})(Runtime);
 class App{}
 Module({imports:[Runtime,...plugins.map(p=>p.apiModule)]})(App);
 const app=await NestFactory.create(App,{logger:false});
 installModuleAssets(app,plugins);
 await app.listen(0,"127.0.0.1");
 const sharedBus=app.get("SYNDES_INBOX_EVENTS");
 assert.equal(sharedBus,app.get("SYNDES_INBOX_EVENTS"),"SSE consumers resolve same Host-global bus");
 assert.equal(typeof sharedBus.publish,"function");
 const base=await app.getUrl();
 const route="/v1/tenants/"+A+"/inbox/conversations";
 try{
  assert.equal((await fetch(base+route)).status,401);
  assert.equal((await fetch(base+"/v1/tenants/"+B+"/inbox/conversations",
   {headers:{authorization:"Bearer inbox-ci"}})).status,403);
  assert.equal(resolutions,0,"Unauthorized requests must not resolve tenant connections");
  const response=await fetch(base+route,{headers:{authorization:"Bearer inbox-ci"}});
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),[]);
  assert.equal(resolutions,2,"Context authorization and scoped Inbox list both resolve a tenant lease");
  // Explicit selection travels through the Nest decorator into the trusted
  // repository guard. Only authenticated actors with matching memberships
  // may use it; malformed partial selection fails before business queries.
  const selectedHeaders={authorization:"Bearer inbox-ci",
   "x-syndes-organization-id":"33333333-3333-4333-8333-333333333333",
   "x-syndes-workspace-id":"44444444-4444-4444-8444-444444444444"};
  assert.equal((await fetch(base+route,{headers:selectedHeaders})).status,200);
  assert.equal((await fetch(base+route,{headers:{
   authorization:"Bearer inbox-ci",
   "x-syndes-organization-id":"33333333-3333-4333-8333-333333333333"
  }})).status,403,"Partial scope must never fall back to tenant-only list");

  const script=await fetch(base+"/inbox/app.js");
  assert.equal(script.status,200);
  assert.match(await script.text(),/code_challenge_method:"S256"/);
  const page=await fetch(base+"/inbox");
  assert.equal(page.status,200);
  assert.match(await page.text(),/Core Inbox/);
  const metrics=await fetch(base+"/v1/tenants/"+A+"/inbox/metrics",
   {headers:{authorization:"Bearer inbox-ci"}});
  assert.equal(metrics.status,200);
  assert.deepEqual(await metrics.json(),{open:0,pending:0,resolved:0,unassigned:0});
 }finally{await app.close()}
});
