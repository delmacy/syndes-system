import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import {NestFactory} from "@nestjs/core";
import {Module,Global} from "@nestjs/common";
import {CoreKernel} from "@syndes/core-kernel";
import {CrmController,CrmHost} from "@syndes/core-crm/plugin";

const tenant="4ab44379-d557-4df6-a2be-d44e121a8077";
const outsiderTenant="d21930aa-f4f6-40c0-bb1a-e71d7bb92caa";
const o="33333333-3333-4333-8333-333333333333";
const w="44444444-4444-4444-8444-444444444444";
test("CRM denies every HTTP route before tenant-wide query without authorized default org/workspace",async()=>{
 const verified=[],resolved=[],queries=[];
 const kernel=new CoreKernel({
  modules:[{id:"platform",version:"0.1.0"},{id:"crm",version:"0.1.0",dependencies:["platform"]}],
  tenancy:{canAccessTenant:async({actor,tenantId})=>tenantId===tenant&&["alice","bob","viewer"].includes(actor.id)},
  authorization:{canAccess:async({resource,action,actor})=>
    resource.startsWith("crm:")&&!(actor.id==="viewer"&&resource==="crm:context")&&
    (actor.id!=="bob"||action==="read")},
 });
 await kernel.start();
 const db={resolve:async tenantId=>{
  resolved.push(tenantId);
  return {tenantId,query:async(sql,values)=>{
   queries.push({sql,values});
   if(sql.includes("FROM platform_organizations o")){
    return {rows:values?.[1]==="alice"?[{organization_id:o,workspace_id:w}]:[],rowCount:values?.[1]==="alice"?1:0};
   }
   return {rows:[],rowCount:0};
  }};
 }};
 class Runtime{}
 Global()(Runtime);
 Module({providers:[
  {provide:"SYNDES_CORE_API",useValue:{kernel,verifier:{verify:async header=>{
   if(header==="Bearer alice")return {id:"alice",kind:"user"};
   if(header==="Bearer bob")return {id:"bob",kind:"user"};
   if(header==="Bearer viewer")return {id:"viewer",kind:"user"};
   throw Error("Invalid bearer");
  }}}},
  {provide:"SYNDES_TENANT_DB",useValue:db},
 ],exports:["SYNDES_CORE_API","SYNDES_TENANT_DB"]})(Runtime);
 class App{}
 Module({imports:[Runtime],controllers:[CrmController],providers:[CrmHost]})(App);
 const app=await NestFactory.create(App,{logger:false});
 await app.listen(0,"127.0.0.1");
 const base=await app.getUrl();
 const api=base+"/v1/tenants/"+tenant+"/crm";
 const h=id=>({authorization:"Bearer "+id});
 const post=(route,id,body)=>fetch(api+route,{method:"POST",headers:{...h(id),"content-type":"application/json"},body:JSON.stringify(body)});
 try{
  assert.equal((await fetch(api+"/people")).status,401);
  assert.equal((await fetch(base+"/v1/tenants/"+outsiderTenant+"/crm/people",{headers:h("alice")})).status,403);
  assert.equal((await fetch(api+"/people",{headers:h("viewer")})).status,403);
  assert.equal(resolved.length,0,"Tenant/FGA denial must not resolve DB");
  const forbiddenRoutes=[
    ()=>fetch(api+"/people",{headers:h("bob")}),
    ()=>fetch(api+"/people?limit=1&q=contact",{headers:h("bob")}),
    ()=>fetch(api+"/people/33333333-3333-4333-8333-333333333333",{headers:h("bob")}),
    ()=>fetch(api+"/organizations",{headers:h("bob")}),
    ()=>fetch(api+"/tags",{headers:h("bob")}),
    ()=>fetch(api+"/employees",{headers:h("bob")}),
    ()=>fetch(api+"/exports/csv",{headers:h("bob")}),
    ()=>fetch(api+"/capabilities",{headers:h("bob")}),
    ()=>post("/imports/csv","bob",{csv:"name\nSecret"}),
    ()=>post("/duplicates","bob",{email:"secret@example.com"}),
  ];
  for(const request of forbiddenRoutes){
   const response=await request();
   assert.equal(response.status,403);
  }
  assert.equal(queries.length,forbiddenRoutes.length,"No CRM business query may run for nonmember");
  assert.ok(queries.every(q=>q.sql.includes("FROM platform_organizations o")));
  const ok=await fetch(api+"/people",{headers:h("alice")});
  assert.equal(ok.status,200);
  assert.deepEqual(await ok.json(),[]);
  assert.ok(queries.at(-1).sql.includes("FROM crm_people"));
  const csv=await fetch(api+"/exports/csv",{headers:h("alice")});
  assert.equal(csv.status,200);
  assert.match(csv.headers.get("content-type"),/text\/csv/);
  assert.equal((await csv.text()).length>0,true);
 }finally{await app.close()}
});
