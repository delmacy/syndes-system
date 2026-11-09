import test from "node:test";
import assert from "node:assert/strict";
import "reflect-metadata";
import { CoreKernel, AccessDeniedError } from "@syndes/core-kernel";
import { CrmController } from "../dist/crm.controller.js";

const tenantA="4ab44379-d557-4df6-a2be-d44e121a8077";
const tenantB="d21930aa-f4f6-40c0-bb1a-e71d7bb92caa";
const actor={id:"agent",kind:"user"};
async function kernel(denied=false) {
 const core=new CoreKernel({
  modules:[{id:"platform",version:"0.1.0"},{id:"crm",version:"0.1.0",dependencies:["platform"]}],
  tenancy:{canAccessTenant:async({tenantId})=>tenantId===tenantA},
  authorization:{canAccess:async({resource,action})=>{
   if(denied)throw new Error("OpenFGA unavailable");
   return resource==="crm:people"&&action==="read";
  }},
 });
 await core.start();
 return core;
}
test("CRM capability response uses FGA and real tenant membership for each action",async()=>{
 const k=await kernel(),selector=()=>assert.fail("capabilities must not select a database");
 const host={core:{kernel:k},pools:{resolve:selector},run:async(tenantId,token,fn)=>fn({actor,tenantId})};
 const controller=new CrmController(host);
 const allowed=await controller.capabilities(tenantA,"Bearer demo");
 assert.equal(allowed["people.read"],true);
 assert.equal(allowed["people.write"],false);
 assert.equal(allowed["notes.write"],false);
 const foreign=await controller.capabilities(tenantB,"Bearer demo");
 assert.ok(Object.values(foreign).every(value=>value===false));
});
test("CRM capabilities fail closed when FGA is unavailable",async()=>{
 const k=await kernel(true);
 const controller=new CrmController({core:{kernel:k},run:async(tenantId,token,fn)=>fn({actor,tenantId})});
 await assert.rejects(controller.capabilities(tenantA,"Bearer demo"),/OpenFGA unavailable/);
});
