import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import {NestFactory} from "@nestjs/core";
import {Module,Global} from "@nestjs/common";
import {CoreKernel} from "@syndes/core-kernel";
import {syndesPlugin} from "@syndes/core-organizations/plugin";

const A="4ab44379-d557-4df6-a2be-d44e121a8077";
const B="d21930aa-f4f6-40c0-bb1a-e71d7bb92caa";
const O="b8db4cda-a2fb-4f67-a96c-06be2abc70b0";
const basePath="/v1/tenants/"+A+"/platform";
test("Organizations HTTP auth, tenant and role denials prevent database access",async()=>{
 const kernel=new CoreKernel({
  modules:[{id:"platform",version:"0.1.0"},syndesPlugin.definition],
  tenancy:{canAccessTenant:async({actor,tenantId})=>tenantId===A&&["admin","viewer"].includes(actor.id)},
  authorization:{canAccess:async({actor,resource,action})=>{
   if(!resource.startsWith("organizations:"))return false;
   return action==="read"||(actor.id==="admin"&&action==="write");
  }},
 });
 await kernel.start();
 const queries=[],resolutions=[];
 const provider={resolve:async tenantId=>{
  resolutions.push(tenantId);
  return {tenantId,query:async(sql,params)=>{
   queries.push({sql,params});
   return {rows:[],rowCount:0};
  }};
 }};
 class Runtime{}
 Global()(Runtime);
 Module({providers:[
  {provide:"SYNDES_CORE_API",useValue:{kernel,verifier:{verify:async header=>{
   if(header==="Bearer ci-admin")return {id:"admin",kind:"user"};
   if(header==="Bearer ci-viewer")return {id:"viewer",kind:"user"};
   throw Error("Invalid credentials");
  }}}},
  {provide:"SYNDES_TENANT_DB",useValue:provider},
 ],exports:["SYNDES_CORE_API","SYNDES_TENANT_DB"]})(Runtime);
 class App{}
 Module({imports:[Runtime,syndesPlugin.apiModule]})(App);
 const app=await NestFactory.create(App,{logger:false});
 await app.listen(0,"127.0.0.1");
 const base=await app.getUrl();
 const headers={authorization:"Bearer ci-admin"};
 try{
  assert.equal((await fetch(base+basePath+"/organizations")).status,401);
  assert.equal((await fetch(base+"/v1/tenants/"+B+"/platform/organizations",{headers})).status,403);
  assert.equal((await fetch(base+basePath+"/organizations",{headers:{authorization:"Bearer bad"}})).status,401);
  assert.equal(resolutions.length,0,"Denied before tenant DB resolution");
  const listing=await fetch(base+basePath+"/organizations",{headers});
  assert.equal(listing.status,200);
  assert.deepEqual(await listing.json(),[]);
  assert.equal(resolutions.length,1);
  const noWrite=await fetch(base+basePath+"/bootstrap",{method:"POST",headers:{authorization:"Bearer ci-viewer"}});
  assert.equal(noWrite.status,403);
  assert.equal(resolutions.length,1,"Denied FGA write before tenant DB");
  const invalid=await fetch(base+basePath+"/organizations/"+O+"/units",{
   method:"POST",headers:{...headers,"content-type":"application/json"},
   body:JSON.stringify({name:"Matriz",kind:"site"})});
  assert.equal(invalid.status,400);
  assert.equal(resolutions.length,1,"Unit validation before DB");
  const noMember=await fetch(base+basePath+"/organizations/"+O+"/units",{
   method:"POST",headers:{...headers,"content-type":"application/json"},
   body:JSON.stringify({name:"Matriz",kind:"headquarters"})});
  assert.equal(noMember.status,404,"No org member means no unit creation");
  assert.equal(queries.length,2);
  assert.equal(queries[1].params[0],A);
  assert.equal(queries[1].params[1],O);
  assert.equal(queries[1].params.at(-1),"admin");
 }finally{await app.close();}
});
