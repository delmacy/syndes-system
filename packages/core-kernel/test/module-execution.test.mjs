import assert from "node:assert/strict";
import test from "node:test";
import {CoreKernel,AccessDeniedError} from "../dist/index.js";

const req={actor:{kind:"user",id:"u1"},tenantId:"a",resource:"crm:people",action:"read",moduleId:"crm"};

function build(tenant=true,fga=true,moduleAccess) {
  return new CoreKernel({
    modules:[{id:"crm",version:"1.0.0",schema:"crm"}],
    tenancy:{canAccessTenant:async()=>tenant},
    authorization:{canAccess:async()=>fga},
    ...(moduleAccess?{moduleAccess:{canExecuteModule:moduleAccess}}:{})
  });
}

test("executeModule requires membership, FGA and enabled module before handler",async()=>{
  for(const [tenant,fga,enabled] of [[false,true,true],[true,false,true],[true,true,false]]) {
    let invoked=false;
    const k=build(tenant,fga,async()=>enabled);await k.start();
    await assert.rejects(k.executeModule(req,()=>{invoked=true;}),AccessDeniedError);
    assert.equal(invoked,false);
  }
  const k=build(true,true,async()=>true);await k.start();
  assert.equal(await k.executeModule(req,ctx=>ctx.moduleId),"crm");
});

test("executeModule rejects unknown module and unavailable module decision",async()=>{
  let handlerCalls=0;
  const k=build(true,true);await k.start();
  await assert.rejects(k.executeModule(req,()=>{handlerCalls++;}),AccessDeniedError);
  await assert.rejects(k.executeModule({...req,moduleId:"unknown"},()=>{handlerCalls++;}),AccessDeniedError);
  assert.equal(handlerCalls,0);
});

test("executeModule rejects module access port outage without bypass",async()=>{
  const k=build(true,true,async()=>{throw Error("unavailable")});await k.start();
  await assert.rejects(k.executeModule(req,()=>true),AccessDeniedError);
});
