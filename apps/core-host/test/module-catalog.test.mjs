import assert from "node:assert/strict";
import test from "node:test";
import {AccessDeniedError} from "@syndes/core-kernel";
import {PgModuleCatalog} from "../dist/module-catalog.js";

const tenantA="10000000-0000-4000-8000-000000000001";
const manifests=[{id:"platform",version:"0.1.0"},{id:"crm",version:"0.1.0",schema:"crm",dependencies:["platform"]}];
test("catalog adapter uses only parameterized canonical tenant, no SQL from input",async()=>{
  let count=0;
  const db={query:async(sql,args)=>{
    count++;assert.deepEqual(args,[tenantA]);assert.match(sql,/tenant_registry/);
    assert.match(sql,/approved=TRUE/);assert.ok(!sql.includes(tenantA));
    return {rows:[{module_id:"crm",version:"0.1.0",schema_name:"crm",dependency_id:null}]};
  }};
  const port=new PgModuleCatalog(db,manifests);
  assert.deepEqual((await port.listAvailableForTenant(tenantA)).map(x=>x.id),["crm"]);
  await assert.rejects(port.listAvailableForTenant("../other"),AccessDeniedError);
  assert.equal(count,1);
});
test("catalog returns no candidate for missing or suspended tenant",async()=>{
  const port=new PgModuleCatalog({query:async()=>({rows:[]})},manifests);
  assert.deepEqual(await port.listAvailableForTenant(tenantA),[]);
});
test("catalog errors and malformed DB rows fail closed",async()=>{
  await assert.rejects(new PgModuleCatalog({query:async()=>{throw Error("DB unavailable")}},manifests)
    .listAvailableForTenant(tenantA),/DB unavailable/);
  await assert.rejects(new PgModuleCatalog({query:async()=>({rows:[{module_id:"crm",version:"0.1.0",schema_name:"public",dependency_id:null}]})},manifests)
    .listAvailableForTenant(tenantA),AccessDeniedError);
});
