import test from "node:test";
import assert from "node:assert/strict";
import {ModuleRegistry} from "@syndes/core-kernel";
import {registeredModules} from "../dist/modules.js";

test("Core Host composes reusable kernel and independent CRM module",()=>{
  const order=new ModuleRegistry(registeredModules).ordered().map(x=>x.id);
  assert.deepEqual(order,["platform","crm"]);
});
