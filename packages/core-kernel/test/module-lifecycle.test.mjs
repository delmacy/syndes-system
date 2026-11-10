import assert from "node:assert/strict";
import test from "node:test";
import {AccessDeniedError,projectTenantModuleStates} from "../dist/index.js";
const available=[
  {id:"crm",version:"0.1.0",schema:"crm",dependencies:[]},
  {id:"inbox",version:"0.1.0",schema:"inbox",dependencies:["crm"]},
];
const row=(id,overrides={})=>({
  moduleId:id,entitlementState:"granted",entitlementCurrent:true,
  installState:"requested",targetVersion:"0.1.0",installedVersion:null,
  hasVerificationMetadata:false,...overrides,
});
test("tenant states keep entitlement, install intent and receipt metadata distinct",()=>{
  const result=projectTenantModuleStates(available,[row("crm")]);
  assert.deepEqual(result.map(x=>[x.moduleId,x.entitled,x.installState,x.hasVerificationMetadata]),[
    ["crm",true,"requested",false],["inbox",false,null,false]
  ]);
});
test("suspension, revocation and expiry never grant entitlement",()=>{
  for (const overrides of [
    {entitlementState:"suspended"},{entitlementState:"revoked"},{entitlementCurrent:false}
  ]) {
    const state=projectTenantModuleStates(available,[row("crm",overrides)])[0];
    assert.equal(state.entitled,false);
  }
});
test("metadata is not installer proof and must match trusted build version",()=>{
  const state=projectTenantModuleStates(available,[
    row("crm",{installState:"enabled",installedVersion:"0.2.0",hasVerificationMetadata:true})
  ])[0];
  assert.equal(state.hasVerificationMetadata,false);
  assert.equal(typeof state.canExecuteModule,"undefined");
});
test("malformed DB snapshots, unexpected untrusted modules and duplicate rows deny",()=>{
  for (const rows of [
    [row("crm",{entitlementState:"approved"})],
    [row("crm",{entitlementCurrent:"true"})],
    [row("crm"),row("crm")],
    [row("other")],
  ])assert.throws(()=>projectTenantModuleStates(available,rows),AccessDeniedError);
});
