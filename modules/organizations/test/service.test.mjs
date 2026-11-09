import test from "node:test";
import assert from "node:assert/strict";
import {OrganizationService,OrgInputError,OrgTenantMismatchError} from "../dist/service.js";
import {AccessDeniedError} from "@syndes/core-kernel";

const tenant="11111111-1111-4111-8111-111111111111";
const other="22222222-2222-4222-8222-222222222222";
const org="33333333-3333-4333-8333-333333333333";
const ctx={tenantId:tenant,actor:{id:"keycloak|alice",kind:"user"}};
function fake({denied=false,dbTenant=tenant,rows=[]}={}){
  const checks=[],resolutions=[],queries=[];
  const kernel={async execute(q,fn){checks.push(q);if(denied)throw new AccessDeniedError();return fn();}};
  const databases={async resolve(id){resolutions.push(id);return {tenantId:dbTenant,async query(sql,params){queries.push({sql,params});return {rows,rowCount:rows.length};}};}};
  return {service:new OrganizationService(kernel,databases),checks,resolutions,queries};
}
test("requires FGA before database, denial is fail-closed",async()=>{
  const f=fake({denied:true});
  await assert.rejects(f.service.listOrganizations(ctx),AccessDeniedError);
  assert.deepEqual(f.resolutions,[]);
  assert.deepEqual(f.queries,[]);
  assert.equal(f.checks[0].resource,"organizations:directory");
});
test("wrong tenant database is rejected before a query",async()=>{
  const f=fake({dbTenant:other});
  await assert.rejects(f.service.listOrganizations(ctx),OrgTenantMismatchError);
  assert.deepEqual(f.queries,[]);
});
test("bootstrap has atomic CTE, first-writer owner only, never grants on retry",async()=>{
  const f=fake();
  const result=await f.service.bootstrap(ctx);
  assert.deepEqual(result,{initialized:false});
  assert.equal(f.checks[0].resource,"organizations:bootstrap");
  assert.equal(f.checks[0].action,"write");
  const {sql,params}=f.queries[0];
  assert.match(sql,/ON CONFLICT DO NOTHING/);
  assert.match(sql,/FROM new_org/);
  assert.match(sql,/workspace_grant/);
  assert.match(sql,/org_grant/);
  assert.match(sql,/default_context_initialized/);
  assert.doesNotMatch(sql,/\bBEGIN\b/);
  assert.deepEqual([params[0],params[3]],[tenant,ctx.actor.id]);
});
test("list queries are parameterized and actor-scoped",async()=>{
  const f=fake({rows:[{id:org}]});
  await f.service.listOrganizations(ctx);
  await f.service.listWorkspaces(ctx,org);
  await f.service.listUnits(ctx,org);
  assert.equal(f.queries.length,3);
  for(const q of f.queries){
    assert.match(q.sql,/tenant_id/);
    assert.match(q.sql,/principal_id/);
    assert.equal(q.params[0],tenant);
    assert.equal(q.params.at(-1),ctx.actor.id);
    assert.doesNotMatch(q.sql,/keycloak\|alice/);
  }
});
test("unit creation checks organization member role in atomic SQL",async()=>{
  const f=fake();
  const result=await f.service.createUnit(ctx,org,{name:" Matriz ",kind:"headquarters"});
  assert.equal(result,null);
  assert.equal(f.checks[0].resource,"organizations:units");
  assert.equal(f.checks[0].action,"write");
  assert.match(f.queries[0].sql,/m\.role IN \('admin','editor'\)/);
  assert.match(f.queries[0].sql,/unit_created/);
  assert.equal(f.queries[0].params[3],"Matriz");
});
test("invalid IDs and unit fields are rejected without DB",async()=>{
  const f=fake();
  assert.throws(()=>f.service.listWorkspaces(ctx,other.slice(1)),OrgInputError);
  assert.throws(()=>f.service.createUnit(ctx,org,{name:"",kind:"branch"}),OrgInputError);
  assert.throws(()=>f.service.createUnit(ctx,org,{name:"A",kind:"site"}),OrgInputError);
  assert.throws(()=>f.service.listOrganizations({...ctx,tenantId:"fake"}),OrgInputError);
  assert.deepEqual(f.queries,[]);
});

test("legacy ownership backfill requires FGA before DB and active default admin role in SQL",async()=>{
  const denied=fake({denied:true});
  await assert.rejects(denied.service.backfillDefaultOwnership(ctx),AccessDeniedError);
  assert.deepEqual(denied.resolutions,[]);
  const fakeRows=[{entity_type:"crm_people",updated_count:"2"},{entity_type:"inbox_conversations",updated_count:"0"}];
  const f=fake({rows:fakeRows});
  const result=await f.service.backfillDefaultOwnership(ctx);
  assert.deepEqual(result,[{entityType:"crm_people",updatedCount:2},{entityType:"inbox_conversations",updatedCount:0}]);
  assert.equal(f.checks[0].resource,"organizations:bootstrap");
  assert.equal(f.checks[0].action,"write");
  assert.match(f.queries[0].sql,/WITH allowed AS MATERIALIZED/);
  assert.match(f.queries[0].sql,/m\.role='admin'/);
  assert.match(f.queries[0].sql,/wm\.role='admin'/);
  assert.match(f.queries[0].sql,/CROSS JOIN LATERAL/);
  assert.match(f.queries[0].sql,/platform_backfill_legacy_ownership\(a\.tenant_id,\$2\)/);
  assert.deepEqual(f.queries[0].params,[tenant,ctx.actor.id]);
});
