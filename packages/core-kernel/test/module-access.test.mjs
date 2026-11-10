import assert from "node:assert/strict";
import test from "node:test";
import {AccessDeniedError, requireModuleAccess, ModuleRegistry} from "../dist/index.js";

const request = {actor:{id:"principal-1",kind:"user"},tenantId:"tenant-a",moduleId:"crm"};

test("module access denies absent port and missing/malformed module identity", async()=>{
  await assert.rejects(requireModuleAccess(undefined,request),AccessDeniedError);
  await assert.rejects(requireModuleAccess({canExecuteModule:async()=>true},{...request,moduleId:"crm;DROP SCHEMA"}),AccessDeniedError);
});

test("module access requires explicit positive Control Plane decision", async()=>{
  for(const verdict of [false,undefined,null]) {
    await assert.rejects(requireModuleAccess({canExecuteModule:async()=>verdict},request),AccessDeniedError);
  }
  let called=false;
  await requireModuleAccess({canExecuteModule:async r=>{called=true;assert.equal(r.tenantId,"tenant-a");return true;}},request);
  assert.equal(called,true);
});

test("module access fails closed on provider outage", async()=>{
  await assert.rejects(requireModuleAccess({canExecuteModule:async()=>{throw new Error("DB unreachable");}},request),AccessDeniedError);
});

test("module registry validates schema identifiers and prevents colliding owners",()=>{
  const valid=[{id:"crm",version:"1.0.0",schema:"crm"},{id:"inbox",version:"1.0.0",schema:"inbox"}];
  assert.deepEqual(new ModuleRegistry(valid).ordered().map(x=>x.schema),["crm","inbox"]);
  assert.throws(()=>new ModuleRegistry([{id:"crm",version:"1.0.0",schema:"public"}]),/reserved|schema/i);
  assert.throws(()=>new ModuleRegistry([{id:"crm",version:"1.0.0",schema:"crm"},{id:"inbox",version:"1.0.0",schema:"crm"}]),/schema/i);
  assert.throws(()=>new ModuleRegistry([{id:"crm",version:"1.0.0",schema:"CRM;DROP"}]),/schema/i);
});
