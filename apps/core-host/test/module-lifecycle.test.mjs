import assert from "node:assert/strict";
import test from "node:test";
import {AccessDeniedError} from "@syndes/core-kernel";
import {PgModuleLifecycle} from "../dist/module-lifecycle.js";
const A="10000000-0000-4000-8000-000000000001";
const B="10000000-0000-4000-8000-000000000002";
const approved=[{id:"crm",version:"0.1.0",schema:"crm",dependencies:[]}];
test("tenant status SQL is parameterized, scopes tenant and does not claim execution",async()=>{
  const seen=[];
  const db={query:async(sql,args)=>{
    seen.push(args);
    assert.match(sql,/tenant_registry.*state='active'/);
    assert.ok(!sql.includes(A));
    return {rows:[{module_id:"crm",entitlement_state:"granted",
      entitlement_current:true,install_state:"requested",target_version:"0.1.0",
      installed_version:null,verification_digest:null,verified_at:null}]};
  }};
  const catalog={listAvailableForTenant:async()=>approved};
  const p=new PgModuleLifecycle(db,catalog);
  assert.deepEqual((await p.listModuleStates(A)).map(x=>[x.moduleId,x.entitled,x.installState]),[
    ["crm",true,"requested"]
  ]);
  assert.deepEqual(seen,[[A]]);
  await assert.rejects(p.listModuleStates("db://other"),AccessDeniedError);
});
test("tenant A/B independent rows and unavailable/deapproved modules omitted",async()=>{
  const db={query:async(_,args)=>({rows:args[0]===A?
    [{module_id:"crm",entitlement_state:"granted",entitlement_current:true,
      install_state:null,target_version:null,installed_version:null,verification_digest:null,verified_at:null}]:[]})};
  const p=new PgModuleLifecycle(db,{listAvailableForTenant:async()=>approved});
  assert.equal((await p.listModuleStates(A))[0].entitled,true);
  assert.equal((await p.listModuleStates(B))[0].entitled,false);
  const noApproval=new PgModuleLifecycle(db,{listAvailableForTenant:async()=>[]});
  assert.deepEqual(await noApproval.listModuleStates(A),[]);
});
test("inaccessible Control DB and malformed data fail closed",async()=>{
  const failing=new PgModuleLifecycle({query:async()=>{throw Error("Control DB down")}},
    {listAvailableForTenant:async()=>approved});
  await assert.rejects(failing.listModuleStates(A),/Control DB down/);
  const forged=new PgModuleLifecycle({query:async()=>({rows:[
    {module_id:"crm",entitlement_state:"granted",entitlement_current:"yes",
      install_state:null,target_version:null,installed_version:null,verification_digest:null,verified_at:null}
  ]})},{listAvailableForTenant:async()=>approved});
  await assert.rejects(forged.listModuleStates(A),AccessDeniedError);
});
