import assert from "node:assert/strict";
import test from "node:test";
import {crmModuleGateMode,inboxModuleGateMode} from "../dist/module-gate-rollout.js";

test("CRM ModuleAccess is gated only by explicit trusted Host setting",()=>{
 assert.equal(crmModuleGateMode(undefined),"legacy");
 assert.equal(crmModuleGateMode("legacy"),"legacy");
 assert.equal(crmModuleGateMode("enforce"),"enforce");
 for(const invalid of ["", "ENFORCE", "true", "false", "disabled", "0", "enforce "]) {
  assert.throws(()=>crmModuleGateMode(invalid),/Invalid SYNDES_CRM_MODULE_GATE/);
 }
});

test("Inbox ModuleAccess is enabled only by explicit server-side mode",()=>{
 assert.equal(inboxModuleGateMode(undefined),"legacy");
 assert.equal(inboxModuleGateMode("legacy"),"legacy");
 assert.equal(inboxModuleGateMode("enforce"),"enforce");
 for(const invalid of ["", "ENFORCE", "true", "false", "disabled", "0", "enforce "]) {
  assert.throws(()=>inboxModuleGateMode(invalid),/Invalid SYNDES_INBOX_MODULE_GATE/);
 }
});
