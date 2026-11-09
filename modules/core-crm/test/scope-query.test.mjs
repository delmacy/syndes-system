import test from "node:test";
import assert from "node:assert/strict";
import {crmOwnerQuery} from "../dist/scope-query.js";
import {TenantDatabaseMismatchError} from "../dist/contracts.js";

const T="11111111-1111-4111-8111-111111111111";
const O="22222222-2222-4222-8222-222222222222";
function fake(){
 const queries=[];
 return {db:{tenantId:T,async query(sql,values){
   queries.push({sql,values});return {rows:[],rowCount:0};
 }},queries};
}
test("explicit CRM owner markers become bound SQL parameters in every clause",async()=>{
 const f=fake();
 await crmOwnerQuery(f.db,O,
  "SELECT 1 FROM crm_people WHERE tenant_id=$1::uuid /*ORG: AND platform_organization_id=@@ORG@@*/ "+
  "AND EXISTS(SELECT 1 FROM crm_tags WHERE tenant_id=$1::uuid /*ORG: AND platform_organization_id=@@ORG@@*/)",
  [T]);
 assert.deepEqual(f.queries[0].values,[T,O]);
 assert.equal((f.queries[0].sql.match(/\$2::uuid/g)||[]).length,2);
 assert.doesNotMatch(f.queries[0].sql,/\/\*ORG:|@@ORG@@/);
 assert.doesNotMatch(f.queries[0].sql,new RegExp(O));
});
test("legacy repository path retains old SQL only without owner scope",async()=>{
 const f=fake();
 await crmOwnerQuery(f.db,undefined,
  "SELECT 1 FROM crm_people WHERE tenant_id=$1::uuid /*ORG: AND platform_organization_id=@@ORG@@*/",[T]);
 assert.deepEqual(f.queries[0].values,[T]);
 assert.doesNotMatch(f.queries[0].sql,/platform_organization_id|\/\*ORG:/);
});
test("a scoped CRM query without an explicit owner clause fails closed",async()=>{
 const f=fake();
 assert.throws(()=>crmOwnerQuery(f.db,O,"SELECT 1 FROM crm_people WHERE tenant_id=$1::uuid",[T]),
  /missing an organization predicate/);
 assert.deepEqual(f.queries,[]);
});
test("invalid organization UUID is rejected before database access",async()=>{
 const f=fake();
 assert.throws(()=>crmOwnerQuery(f.db,"'OR 1=1",
  "SELECT 1 /*ORG: WHERE platform_organization_id=@@ORG@@*/",[]),TenantDatabaseMismatchError);
 assert.deepEqual(f.queries,[]);
});
