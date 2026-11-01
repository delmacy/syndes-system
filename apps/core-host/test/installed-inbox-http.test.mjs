import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import {NestFactory} from "@nestjs/core";
import {Module,Global} from "@nestjs/common";
import {CoreKernel} from "@syndes/core-kernel";
import {loadInstalledPlugins,installModuleAssets} from "../dist/module-host.js";
const A="4ab44379-d557-4df6-a2be-d44e121a8077";
const B="d21930aa-f4f6-40c0-bb1a-e71d7bb92caa";

test("Inbox package mounts API/UI independently; auth and tenant denial run before SQL",async()=>{
 const installed=await loadInstalledPlugins();
 assert.deepEqual(installed.map(x=>x.definition.id),["crm","inbox"]);
 const kernel=new CoreKernel({
  modules:[{id:"platform",version:"0.1.0"},...installed.map(x=>x.definition)],
  tenancy:{canAccessTenant:async({actor,tenantId})=>actor.id==="alice"&&tenantId===A},
  authorization:{canAccess:async({actor,resource})=>actor.id==="alice"&&resource.startsWith("inbox:")}
 });
 await kernel.start();
 let selected=0;
 class Runtime{}
 Global()(Runtime);
 Module({providers:[
   {provide:"SYNDES_CORE_API",useValue:{
     kernel,verifier:{verify:async header=>{
       if(header!=="Bearer ci-token")throw Error("Unauthorized");
       return {id:"alice",kind:"user"};
     }}
   }},
   {provide:"SYNDES_TENANT_DB",useValue:{resolve:async id=>{
      selected++;return {tenantId:id,query:async()=>({rows:[],rowCount:0})};
   }}},
 ],exports:["SYNDES_CORE_API","SYNDES_TENANT_DB"]})(Runtime);
 class TestModule{}
 Module({imports:[Runtime,...installed.map(x=>x.apiModule)]})(TestModule);
 const app=await NestFactory.create(TestModule,{logger:false});
 installModuleAssets(app,installed);
 await app.listen(0,"127.0.0.1");
 const base=await app.getUrl(),url="/v1/tenants/"+A+"/inbox/conversations";
 try {
  assert.equal((await fetch(base+url)).status,401);
  assert.equal((await fetch(base+"/v1/tenants/"+B+"/inbox/conversations",
    {headers:{authorization:"Bearer ci-token"}})).status,403);
  assert.equal(selected,0,"No tenant pool lookup before authorization");
  const allowed=await fetch(base+url,{headers:{authorization:"Bearer ci-token"}});
  assert.equal(allowed.status,200);
  assert.deepEqual(await allowed.json(),[]);
  assert.equal(selected,1);
  const inbound=await fetch(base+"/v1/tenants/"+A+"/inbox/inbound",{
    method:"POST",headers:{authorization:"Bearer ci-token","content-type":"application/json"},
    body:JSON.stringify({source:"whatsapp",externalRef:"55119999",externalMessageId:"remote",body:"Hi"})
  });
  assert.equal(inbound.status,400,"User token may not ingest provider messages");
  assert.equal(selected,1);
  const page=await fetch(base+"/inbox");
  assert.equal(page.status,200);
  assert.match(await page.text(),/SYNDES/);
  const js=await fetch(base+"/inbox/app.js");
  assert.equal(js.status,200);
  assert.match(await js.text(),/code_challenge_method:"S256"/);
  assert.equal((await fetch(base+"/inbox/invalid-asset")).status,404);
 }finally{await app.close()}
});
