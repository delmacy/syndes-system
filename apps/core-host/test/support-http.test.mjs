import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import {NestFactory} from "@nestjs/core";
import {Module,Global} from "@nestjs/common";
import {CoreKernel} from "@syndes/core-kernel";
import {SupportHttpModule} from "@syndes/core-support";
const T="11111111-1111-4111-8111-111111111111",FOREIGN="22222222-2222-4222-8222-222222222222";

test("Support Nest HTTP rejects anonymous, foreign tenant, absent grants and fake case IDs before tenant DB",async()=>{
 const old=process.env.SYNDES_SUPPORT_TENANT_ID;
 process.env.SYNDES_SUPPORT_TENANT_ID=T;
 let queryCalls=0;
 const kernel=new CoreKernel({
  modules:[{id:"platform",version:"0.1.0"},{id:"crm",version:"0.1.0",dependencies:["platform"]},
   {id:"inbox",version:"0.1.0",dependencies:["platform","crm"]},
   {id:"whatsapp",version:"0.1.0",dependencies:["platform","inbox"]},
   {id:"organizations",version:"0.1.0",dependencies:["platform"]},
   {id:"support",version:"0.1.0",dependencies:["platform","crm","inbox","whatsapp","organizations"]}],
  tenancy:{canAccessTenant:async({actor,tenantId})=>actor.id==="alice"&&tenantId===T},
  authorization:{canAccess:async({actor,resource})=>actor.id==="alice"&&resource==="support:cases:internal"}
 });
 await kernel.start();
 let leases=0;
 const db={resolve:async tenantId=>{
  leases++;
  return {tenantId,query:async(sql,args)=>{
   queryCalls++;
   assert.match(sql,/c.tenant_id/);
   assert.equal(args[0],T);
   return {rows:[],rowCount:0};
  }};
 }};
 class HostPorts{}
 Global()(HostPorts);
 Module({providers:[
  {provide:"SYNDES_CORE_API",useValue:{kernel,verifier:{
   verifyClient:async(header,clientId)=>{
    if(clientId!=="syndes-support-ui"||header!=="Bearer synthetic-test-token")throw Error("Invalid Support OIDC client");
    return {id:"alice",kind:"user"};
   }
  }}},
  {provide:"SYNDES_TENANT_DB",useValue:db},
 ],exports:["SYNDES_CORE_API","SYNDES_TENANT_DB"]})(HostPorts);
 class Application{}
 Module({imports:[HostPorts,SupportHttpModule]})(Application);
 const app=await NestFactory.create(Application,{logger:false});
 await app.listen(0,"127.0.0.1");
 const base=await app.getUrl();
 const headers={authorization:"Bearer synthetic-test-token"};
 try{
  const path="/v1/tenants/"+T+"/support/internal/cases";
  assert.equal((await fetch(base+path)).status,401);
  assert.equal((await fetch(base+path,{headers:{authorization:"Bearer workspace-token"}})).status,401,
    "A token for a different OIDC client is denied before querying a tenant");
  assert.equal((await fetch(base+"/v1/tenants/"+FOREIGN+"/support/internal/cases",{headers})).status,403);
  assert.equal((await fetch(base+"/v1/tenants/"+T+"/support/external/cases",{headers})).status,403);
  assert.equal((await fetch(base+path+"/../../secrets",{headers})).status,404);
  assert.equal(leases,0);
  assert.equal((await fetch(base+path+"?status=invalid",{headers})).status,400);
  assert.equal(leases,0);
  const allowed=await fetch(base+path,{headers});
  assert.equal(allowed.status,200);
  assert.deepEqual(await allowed.json(),[]);
  assert.equal(leases,1);assert.equal(queryCalls,1);
 }finally{
  await app.close();
  if(old===undefined)delete process.env.SYNDES_SUPPORT_TENANT_ID;
  else process.env.SYNDES_SUPPORT_TENANT_ID=old;
 }
});
