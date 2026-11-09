import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import {NestFactory} from "@nestjs/core";
import {Module,Global} from "@nestjs/common";
import {CoreKernel} from "@syndes/core-kernel";
import {loadInstalledPlugins,installModuleAssets} from "../dist/module-host.js";

const A="4ab44379-d557-4df6-a2be-d44e121a8077";
const B="d21930aa-f4f6-40c0-bb1a-e71d7bb92caa";

test("installed CRM HTTP Nest module mounts through generic host runtime ports",async()=>{
 const installed=await loadInstalledPlugins();
 const kernel=new CoreKernel({
   modules:[{id:"platform",version:"0.1.0"},...installed.map(x=>x.definition)],
   tenancy:{canAccessTenant:async({actor,tenantId})=>actor.id==="alice"&&tenantId===A},
   authorization:{canAccess:async({actor,resource})=>actor.id==="alice"&&resource.startsWith("crm:")},
 });
 await kernel.start();
 let selected=0;
 const db={resolve:async id=>{
   selected++;
   return {tenantId:id,query:async sql=>({
     rows:sql.includes("FROM platform_organizations o")
       ? [{organization_id:"33333333-3333-4333-8333-333333333333",
           workspace_id:"44444444-4444-4444-8444-444444444444"}]
       : [],
     rowCount:sql.includes("FROM platform_organizations o")?1:0
   })};
 }};
 class Runtime{}
 Global()(Runtime);
 Module({providers:[
   {provide:"SYNDES_CORE_API",useValue:{kernel,verifier:{
     verify:async header=>{
       if(header!=="Bearer ci-token")throw Error("Invalid token");
       return {id:"alice",kind:"user"};
     },
   }}},
   {provide:"SYNDES_TENANT_DB",useValue:db},
 ],exports:["SYNDES_CORE_API","SYNDES_TENANT_DB"]})(Runtime);
 class TestApp{}
 Module({imports:[Runtime,...installed.map(x=>x.apiModule)]})(TestApp);
 const app=await NestFactory.create(TestApp,{logger:false});
 installModuleAssets(app,installed);
 await app.listen(0,"127.0.0.1");
 const base=await app.getUrl();
 const route="/v1/tenants/"+A+"/crm/people";
 try{
   assert.equal((await fetch(base+route)).status,401);
   assert.equal((await fetch(base+"/v1/tenants/"+B+"/crm/people",
     {headers:{authorization:"Bearer ci-token"}})).status,403);
   assert.equal(selected,0,"Authorization denied before tenant DB selection");
   const allowed=await fetch(base+route,{headers:{authorization:"Bearer ci-token"}});
   assert.equal(allowed.status,200);
   assert.deepEqual(await allowed.json(),[]);
   assert.equal(selected,2,"Org authorization and CRM query each resolve a trusted tenant lease");
   const ui=await fetch(base+"/crm");
   assert.equal(ui.status,200);
   assert.match(await ui.text(),/Core CRM/);
   const js=await fetch(base+"/crm/app.js");
   assert.equal(js.status,200);
   assert.match(await js.text(),/\/modules\/crm\/config/);
   const unknown=await fetch(base+"/crm/not-declared");
   assert.equal(unknown.status,404);
 } finally {await app.close()}
});
