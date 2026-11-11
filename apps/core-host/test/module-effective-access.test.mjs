import assert from "node:assert/strict";
import test from "node:test";
import {PgEffectiveModuleAccess} from "../dist/module-effective-access.js";
const A="11111111-1111-4111-8111-111111111111";
const B="22222222-2222-4222-8222-222222222222";
const actor={id:"signed-principal",kind:"user"};
const call=(port,id="crm",tenantId=A)=>port.canExecuteModule({actor,tenantId,moduleId:id});
const row=(id,deps=[],extra={})=>({
  moduleId:id,version:"0.1.0",schema:id,dependencies:deps,
  entitlementState:"granted",entitled:true,installState:"enabled",
  targetVersion:"0.1.0",installedVersion:"0.1.0",
  hasVerificationMetadata:true,...extra,
});
test("effective access requires entitlement, enabled state and matching verified version",async()=>{
 const cases=[
  {entitled:false},{entitlementState:"suspended",entitled:false},
  {installState:"requested"},{installState:"installed"},
  {installState:"suspended"},{installState:"retired"},
  {targetVersion:"0.2.0"},{installedVersion:"0.2.0"},
  {hasVerificationMetadata:false},
  {entitlementState:"revoked",entitled:true},
  {version:undefined,targetVersion:undefined,installedVersion:undefined},
  {schema:"public;DROP"},
 ];
 for(const change of cases){
  const port=new PgEffectiveModuleAccess({listModuleStates:async()=>[row("crm",[],change)]});
  assert.equal(await call(port),false,JSON.stringify(change));
 }
 const passing=new PgEffectiveModuleAccess({listModuleStates:async()=>[row("crm")]});
 assert.equal(await call(passing),true);
});
test("dependency must be entitled and enabled in same tenant; cannot borrow from tenant B",async()=>{
 const byTenant={
  [A]:[row("crm"),row("inbox",["crm"])],
  [B]:[row("crm",[],{entitled:false}),row("inbox",["crm"])],
 };
 const port=new PgEffectiveModuleAccess({listModuleStates:async tenant=>byTenant[tenant]??[]});
 assert.equal(await call(port,"inbox",A),true);
 assert.equal(await call(port,"inbox",B),false);
 byTenant[A]=[row("crm",[],{installState:"installed"}),row("inbox",["crm"])];
 assert.equal(await call(port,"inbox",A),false);
});
test("untrusted snapshots, unknown modules, cycles, duplicates and Control outages deny",async()=>{
 const cases=[
  [row("inbox",["crm"])], // missing dependency
  [row("crm"),row("crm")],
  [row("crm",["inbox"]),row("inbox",["crm"])],
  [row("crm",["not-installed"])],
  [],
 ];
 for(const states of cases){
  const port=new PgEffectiveModuleAccess({listModuleStates:async()=>states});
  assert.equal(await call(port),false);
 }
 const failing=new PgEffectiveModuleAccess({listModuleStates:async()=>{throw Error("Control DB down");}});
 assert.equal(await call(failing),false);
 const passing=new PgEffectiveModuleAccess({listModuleStates:async()=>[row("crm")]});
 assert.equal(await call(passing,"missing"),false);
 assert.equal(await passing.canExecuteModule({actor,tenantId:"postgres://tenant",moduleId:"crm"}),false);
 assert.equal(await passing.canExecuteModule({actor:{kind:"user",id:""},tenantId:A,moduleId:"crm"}),false);
});
