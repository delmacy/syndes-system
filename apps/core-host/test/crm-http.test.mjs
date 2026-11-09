import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import {NestFactory} from "@nestjs/core";
import {Module,HttpException} from "@nestjs/common";
import {CrmController,CrmHost} from "@syndes/core-crm/plugin";

const A="4ab44379-d557-4df6-a2be-d44e121a8077";
const B="d21930aa-f4f6-40c0-bb1a-e71d7bb92caa";
test("CRM HTTP routes reject unauthenticated and cross-tenant calls",async()=>{
 const calls=[];
 const fakeHost={
   run:async (tenant,bearer,handler)=>{
     if(bearer!=="Bearer ci-token")throw new HttpException("Unauthorized",401);
     if(tenant!==A)throw new HttpException("Forbidden",403);
     return handler({tenantId:tenant,actor:{id:"alice",kind:"user"}});
   },
   crm:{
     createPerson:async(ctx,data)=>{
       calls.push({ctx,data});
       return {id:"created",tenantId:ctx.tenantId,name:data.name};
     },
     listPeople:async()=>[{id:"p-1",name:"Maria"}],
   },
   extra:{listOrganizations:async()=>[]},
 };
 class HttpTestModule{}
 Module({controllers:[CrmController],providers:[{provide:CrmHost,useValue:fakeHost}]})(HttpTestModule);
 const app=await NestFactory.create(HttpTestModule,{logger:false});
 await app.listen(0,"127.0.0.1");
 const base=await app.getUrl();
 const route="/v1/tenants/"+A+"/crm/people";
 try{
   const unauthorized=await fetch(base+route);
   assert.equal(unauthorized.status,401);
   const cross=await fetch(base+"/v1/tenants/"+B+"/crm/people",{headers:{authorization:"Bearer ci-token"}});
   assert.equal(cross.status,403);
   const created=await fetch(base+route,{method:"POST",
     headers:{"content-type":"application/json",authorization:"Bearer ci-token"},
     body:JSON.stringify({name:"Maria"})});
   assert.equal(created.status,201);
   assert.equal((await created.json()).name,"Maria");
   assert.equal(calls[0].ctx.tenantId,A);
   assert.equal((await (await fetch(base+route,{headers:{authorization:"Bearer ci-token"}})).json())[0].name,"Maria");
 } finally {await app.close()}
});
