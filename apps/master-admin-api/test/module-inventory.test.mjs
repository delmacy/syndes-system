import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {createHandler} from "../src/server.mjs";
import {readTenantModuleInventory} from "../src/modules/tenant-module-inventory.mjs";

const A="11111111-1111-4111-8111-111111111111";
const B="22222222-2222-4222-8222-222222222222";
const path=id=>"/v1/platform/admin/tenants/"+id+"/modules";
const origin="https://manager.example.test";
const rows={
 [A]:[
  {module_id:"crm",schema_name:"crm",approved_versions:["0.1.0"],
   entitlement_state:"granted",entitlement_current:true,valid_until:null,
   installation_state:"installed",target_version:"0.1.0",installed_version:"0.1.0",verified_at:new Date("2026-11-10T11:00:00Z")},
  {module_id:"inbox",schema_name:"inbox",approved_versions:["0.1.0"],
   entitlement_state:"suspended",entitlement_current:false,valid_until:null,
   installation_state:"requested",target_version:"0.1.0",installed_version:null,verified_at:null},
 ],
 [B]:[
  {module_id:"crm",schema_name:"crm",approved_versions:["0.1.0"],
   entitlement_state:null,entitlement_current:null,valid_until:null,
   installation_state:null,target_version:null,installed_version:null,verified_at:null},
  {module_id:"inbox",schema_name:"inbox",approved_versions:[],
   entitlement_state:null,entitlement_current:null,valid_until:null,
   installation_state:null,target_version:null,installed_version:null,verified_at:null},
 ]
};
const poolFor=(calls,opts={})=>({query:async(sql,args=[])=>{
 calls.push({sql,args});
 if(sql.includes("platform_operator_access"))
  return {rows:args[0]==="platform-owner"?[{role:"owner"}]:
   args[0]==="platform-viewer"?[{role:"viewer"}]:[]};
 if(sql.includes("public.tenant_registry WHERE tenant_id")){
  return {rows:opts.missing?[]:[{id:args[0],state:args[0]===A?"active":"suspended"}]};
 }
 if(sql.includes("FROM public.module_catalog c")){
  if(opts.outage)throw Error("catalog relation missing");
  return {rows:rows[args[0]]??[]};
 }
 throw Error("Unexpected query");
}});
test("module inventory returns Control metadata only; A/B entitlement isolation and receipts withheld",async()=>{
 const calls=[],pool=poolFor(calls);
 const a=await readTenantModuleInventory(pool,A);
 const b=await readTenantModuleInventory(pool,B);
 assert.equal(a.tenantId,A);
 assert.deepEqual(a.items.map(x=>[x.moduleId,x.entitled,x.installationState]),[
  ["crm",true,"installed"],["inbox",false,"requested"],
 ]);
 assert.deepEqual(b.items.map(x=>[x.moduleId,x.entitled,x.installationState]),[
  ["crm",false,null],["inbox",false,null],
 ]);
 assert.deepEqual(b.items[1].approvedVersions,[]);
 for(const item of [...a.items,...b.items]){
  for(const prop of ["schemaName","databaseName","roleName","verificationDigest","receipt","password","secret"]){
   assert.equal(prop in item,false);
  }
 }
 const sql=calls.filter(x=>x.sql.includes("FROM public.module_catalog c"));
 assert.equal(sql.length,2);
 assert.deepEqual(sql.map(x=>x.args),[[A],[B]]);
 assert.doesNotMatch(sql[0].sql,/syndes_tenant_|tenant_pg|tenant_connection/);
});
test("Manager HTTP module inventory is authenticated, read-only and denies client tokens",async()=>{
 const calls=[],pool=poolFor(calls);
 const handler=createHandler({
  pool,publicOrigin:origin,
  verify:async header=>{
   if(header==="Bearer platform-owner")return "platform-owner";
   if(header==="Bearer platform-viewer")return "platform-viewer";
   if(header==="Bearer tenant-token")return "tenant-user";
   throw Error("Invalid token");
  },
 });
 const server=createServer(handler);
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const url="http://127.0.0.1:"+server.address().port;
 const request=(path,actor,init={})=>fetch(url+path,{
  ...init,headers:actor?{authorization:"Bearer "+actor,...init.headers}:init.headers
 });
 try{
  assert.equal((await request(path(A),null)).status,401);
  assert.equal(calls.length,0);
  assert.equal((await request(path(A),"tenant-token")).status,403);
  assert.equal((await request(path(A),"platform-viewer")).status,200);
  const value=await (await request(path(A),"platform-owner")).json();
  assert.equal(value.items[0].entitled,true);
  assert.equal(value.items[1].entitled,false);
  assert.equal((await request(path(B),"platform-owner")).status,200);
  assert.equal((await request(path(A)+"?x=1","platform-owner")).status,400);
  assert.equal((await request(path("invalid"),"platform-owner")).status,400);
  assert.equal((await request(path(A),"platform-owner",{method:"POST"})).status,404);
  assert.equal((await request(path(A),"platform-owner",{
   headers:{origin:"https://workspace.example.test"},
  })).status,403);
  const all=calls.filter(x=>x.sql.includes("FROM public.module_catalog c"));
  assert.equal(all.length,3);
  assert.deepEqual(all.map(x=>x.args),[[A],[A],[B]]);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test("catalog not provisioned fails closed (503), never pretends no modules",async()=>{
 const calls=[],pool=poolFor(calls,{outage:true});
 const handler=createHandler({pool,publicOrigin:origin,
  verify:async()=> "platform-owner"});
 const server=createServer(handler);
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 try{
  const r=await fetch("http://127.0.0.1:"+server.address().port+path(A),{
   headers:{authorization:"Bearer platform-owner"},
  });
  assert.equal(r.status,503);
  assert.deepEqual(await r.json(),{error:"Module inventory unavailable"});
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test("missing tenant returns 404 without fetching catalog or tenant data",async()=>{
 const calls=[],pool=poolFor(calls,{missing:true});
 const result=await readTenantModuleInventory(pool,A);
 assert.equal(result,null);
 assert.equal(calls.length,1);
});
