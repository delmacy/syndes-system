import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import {NestFactory} from "@nestjs/core";
import {Module,Global} from "@nestjs/common";
import {CoreKernel,PINNED_TENANT_TRANSACTION} from "@syndes/core-kernel";
import {syndesPlugin} from "../dist/plugin.js";
import {readFile} from "node:fs/promises";

const TENANT="67aabcda-7f06-4840-977d-8b80a20e4241";
const ORG="2878811d-ebba-49c3-8cd5-50555c0b5eb4";
const WORKSPACE="777bfcdf-f77c-475f-b9fa-75e01fb6b8c1";
const FOREIGN="895d425f-5234-41e3-85e5-c9aa764f9d1b";
const route="/v1/tenants/"+TENANT+"/service-management/funnels";
const headers={
 authorization:"Bearer valid-workspace-user",
 "x-syndes-organization-id":ORG,
 "x-syndes-workspace-id":WORKSPACE,
};

test("service-management plugin is valid but NOT in default Host installed modules",async()=>{
 assert.equal(syndesPlugin.definition.id,"service-management");
 assert.deepEqual(syndesPlugin.migrations.map(x=>x.id),["001_service_funnels"]);
 assert.deepEqual(syndesPlugin.permissions.map(x=>x.resource),[
  "service-management:funnels","service-management:attendances",
 ]);
 const config=JSON.parse(await readFile(new URL("../../../apps/core-host/config/modules.json",import.meta.url),"utf8"));
 assert.equal(config.modules.some(m=>m==="@syndes/service-management/plugin"),false,
  "New plugin must not accidentally auto-mount in operational Host config");
});

test("Nest opt-in HTTP adapter: JWT, scope, FGA and Module ENABLED fail closed",async()=>{
 let enabled=false,canAccess=true,hasDb=true,dbQueries=0,txCalls=0,checks=0;
 const kernel=new CoreKernel({
  modules:[{id:"platform",version:"0.1.0"},
   {id:"organizations",version:"0.1.0",dependencies:["platform"]},
   {id:"crm",version:"0.1.0",dependencies:["platform"]},
   {id:"inbox",version:"0.1.0",dependencies:["crm"]},
   syndesPlugin.definition],
  tenancy:{canAccessTenant:async({actor,tenantId})=>
   actor.id==="authorized-user"&&tenantId===TENANT},
  authorization:{canAccess:async()=>canAccess},
  moduleAccess:{canExecuteModule:async ({moduleId})=>{
   checks++;
   assert.equal(moduleId,"service-management");
   return enabled;
  }},
 });
 await kernel.start();
 const provider={
  withTransaction:async(tenantId,work)=>{
   txCalls++;
   if(!hasDb)throw new Error("SQL unavailable");
   const tx={
    tenantId,[PINNED_TENANT_TRANSACTION]:true,
    query:async(sql,params=[])=>{
     dbQueries++;
     if(sql.includes("FROM platform_workspaces w")){
      assert.equal(params[0],TENANT);
      assert.equal(params[1],ORG);
      assert.equal(params[2],WORKSPACE);
      assert.equal(params[3],"authorized-user");
      return {rows:[{ok:1}],rowCount:1};
     }
     if(sql.includes("SELECT f.id::text")||sql.includes("SELECT * FROM service_attendances"))
      return {rows:[],rowCount:0};
     throw new Error("Unexpected SQL query in HTTP test");
    },
   };
   return work(tx);
  },
 };
 class Runtime{}
 Global()(Runtime);
 Module({providers:[
  {provide:"SYNDES_CORE_API",useValue:{
   kernel,verifier:{verify:async auth=>{
    if(auth!=="Bearer valid-workspace-user")throw Error("Bad bearer");
    return {id:"authorized-user",kind:"user"};
   }},
  }},
  {provide:"SYNDES_TENANT_DB",useValue:provider},
 ],exports:["SYNDES_CORE_API","SYNDES_TENANT_DB"]})(Runtime);
 class HostApp{}
 Module({imports:[Runtime,syndesPlugin.apiModule]})(HostApp);
 const app=await NestFactory.create(HostApp,{logger:false});
 await app.listen(0,"127.0.0.1");
 const base=await app.getUrl();
 try{
  const send=(path=route,h=headers)=>fetch(base+path,{headers:h});
  assert.equal((await send(route,{})).status,401);
  assert.equal((await send(route,{authorization:headers.authorization})).status,403);
  assert.equal((await send(route,{...headers,"x-syndes-workspace-id":undefined})).status,403);
  assert.equal((await send(route.replace(TENANT,FOREIGN))).status,403);
  assert.equal(dbQueries,0);
  assert.equal(txCalls,0);
  assert.equal((await send()).status,403,"module not ENABLED");
  assert.equal(txCalls,0);
  enabled=true;
  canAccess=false;
  assert.equal((await send()).status,403,"FGA explicit deny");
  assert.equal(txCalls,0);
  canAccess=true;
  hasDb=false;
  assert.equal((await send()).status,503,"SQL outage fails closed");
  assert.equal(txCalls,1);
  hasDb=true;
  const allowed=await send();
  assert.equal(allowed.status,200);
  assert.deepEqual(await allowed.json(),[]);
  assert.equal(txCalls,2);
  assert.ok(dbQueries>=2);
  const absent=await send(route.replace("/funnels","/attendances/"+FOREIGN));
  assert.equal(absent.status,404);
  // Reading does not require a command mutation or fabricate Kanban data.
  const wrongBody=await fetch(base+route,{
   method:"POST",headers:{...headers,"content-type":"application/json"},
   body:JSON.stringify({code:"?;DROP",name:"Unsafe",stages:[]}),
  });
  assert.equal(wrongBody.status,400);
  assert.ok(checks>=2);
 }finally{await app.close()}
});
