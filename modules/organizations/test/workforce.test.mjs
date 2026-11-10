import test from "node:test";
import assert from "node:assert/strict";
import {WorkforceService} from "../dist/workforce.js";
import {OrgInputError,OrgTenantMismatchError} from "../dist/service.js";
import {AccessDeniedError} from "@syndes/core-kernel";

const tenant="11111111-1111-4111-8111-111111111111";
const other="22222222-2222-4222-8222-222222222222";
const org="33333333-3333-4333-8333-333333333333";
const ws="44444444-4444-4444-8444-444444444444";
const employee="55555555-5555-4555-8555-555555555555";
const ctx={tenantId:tenant,actor:{id:"keycloak-sub-a",kind:"user"}};

function fixture({fgaDeny=false,dbTenant=tenant,rows=[]}={}){
 const checks=[],resolved=[],queries=[];
 const service=new WorkforceService({
  async execute(q,callback){
   checks.push(q);
   if(fgaDeny)throw new AccessDeniedError();
   return callback();
  },
 },{
  async resolve(t){
   resolved.push(t);
   return {tenantId:dbTenant,async query(sql,values){
    queries.push({sql,values});
    return {rows,rowCount:rows.length};
   }};
  },
 });
 return {service,checks,resolved,queries};
}

test("FGA rejects every staff operation before the tenant DB can be resolved",async()=>{
 const f=fixture({fgaDeny:true});
 await assert.rejects(f.service.myProfile(ctx,org,ws),AccessDeniedError);
 await assert.rejects(f.service.bindEmployee(ctx,org,ws,employee,"someone"),AccessDeniedError);
 await assert.rejects(f.service.assignWorkspaceRole(ctx,org,ws,"someone","supervisor"),AccessDeniedError);
 await assert.rejects(f.service.revokeWorkspaceRole(ctx,org,ws,"someone"),AccessDeniedError);
 await assert.rejects(f.service.createTeam(ctx,org,ws,"Support"),AccessDeniedError);
 await assert.rejects(f.service.addTeamMember(ctx,org,ws,org,"someone","member"),AccessDeniedError);
 assert.deepEqual(f.resolved,[]);
 assert.deepEqual(f.queries,[]);
 assert.equal(f.checks.every(q=>q.resource==="organizations:staff"),true);
 assert.equal(f.checks[0].action,"read");
 assert.equal(f.checks.slice(1).every(q=>q.action==="write"),true);
});

test("wrong database handle cannot read or change cross-tenant staff",async()=>{
 const f=fixture({dbTenant:other});
 await assert.rejects(f.service.myProfile(ctx,org,ws),OrgTenantMismatchError);
 await assert.rejects(f.service.assignWorkspaceRole(ctx,org,ws,"bob","agent"),OrgTenantMismatchError);
 assert.deepEqual(f.queries,[]);
 assert.deepEqual(f.resolved,[tenant,tenant]);
});

test("invalid scope, forged type and unknown role never acquire DB handle",async()=>{
 const f=fixture();
 assert.throws(()=>f.service.myProfile(ctx,other.slice(2),ws),OrgInputError);
 assert.throws(()=>f.service.assignWorkspaceRole(ctx,org,ws,"bob","platform_owner"),OrgInputError);
 assert.throws(()=>f.service.assignWorkspaceRole(ctx,org,ws,"bob","organization_admin"),OrgInputError);
 assert.throws(()=>f.service.addTeamMember(ctx,org,ws,employee,"bob","superuser"),OrgInputError);
 assert.throws(()=>f.service.bindEmployee(ctx,org,ws,"bad","bob"),OrgInputError);
 assert.throws(()=>f.service.createTeam(ctx,org,ws,""),OrgInputError);
 assert.throws(()=>f.service.myProfile({...ctx,actor:{kind:"service",id:ctx.actor.id}},org,ws),OrgInputError);
 assert.deepEqual(f.resolved,[]);
 assert.deepEqual(f.queries,[]);
});

test("role eligibility is checked against active verified memberships, CRM identity and scope",async()=>{
 const f=fixture({rows:[{employeeId:employee,businessRole:"agent",organizationId:org,workspaceId:ws}]});
 const result=await f.service.myProfile(ctx,org,ws);
 assert.deepEqual(result,{employeeId:employee,businessRole:"agent",organizationId:org,workspaceId:ws});
 const q=f.queries[0];
 for(const table of ["platform_staff_identity_links","platform_workspace_staff_roles",
  "crm_employees","crm_people","platform_org_memberships",
  "platform_workspace_memberships"]){
  assert.match(q.sql,new RegExp(table));
 }
 assert.match(q.sql,/l\.state='active'/);
 assert.match(q.sql,/wr\.state='active'/);
 assert.match(q.sql,/e\.active=true/);
 assert.match(q.sql,/om\.state='active'/);
 assert.match(q.sql,/wm\.state='active'/);
 assert.deepEqual(q.values,[tenant,org,ws,ctx.actor.id]);
});

test("write authorization stays in one actor-scoped statement with automatic audit triggers",async()=>{
 const f=fixture();
 assert.equal(await f.service.bindEmployee(ctx,org,ws,employee,"agent-a"),false);
 assert.equal(await f.service.assignWorkspaceRole(ctx,org,ws,"agent-a","supervisor"),false);
 assert.equal(await f.service.revokeWorkspaceRole(ctx,org,ws,"agent-a"),false);
 assert.equal(await f.service.createTeam(ctx,org,ws,"Support"),null);
 assert.equal(await f.service.addTeamMember(ctx,org,ws,employee,"agent-a","member"),false);
 assert.equal(f.queries.length,5);
 for(const q of f.queries){
  assert.match(q.sql,/MATERIALIZED/);
  assert.match(q.sql,/role='admin'/);
  assert.match(q.sql,/state='active'/);
  assert.ok(q.values.includes(ctx.actor.id));
  assert.equal(q.values[0],tenant);
  assert.doesNotMatch(q.sql,/platform_operator_access/);
 }
 assert.match(f.queries[0].sql,/platform_staff_identity_links/);
 assert.match(f.queries[1].sql,/platform_workspace_staff_roles/);
 assert.match(f.queries[3].sql,/platform_staff_access_audit/);
 assert.match(f.queries[4].sql,/platform_staff_team_members/);
});

test("staff migration remains opt-in and preserves physical SQL 002 preflight",async()=>{
 const {readFile}=await import("node:fs/promises");
 const {syndesPlugin}=await import("../dist/plugin.js");
 assert.equal(syndesPlugin.migrations.some(x=>x.id.includes("007")||
   x.fileUrl.includes("staff_roles")),false,
   "Workforce staff schema must not enter automatic migrations before Product Gate");
 const sql=await readFile(new URL("../sql/007_staff_roles_pre_release.sql",import.meta.url),"utf8");
 for(const index of ["platform_legacy_single_organization","platform_legacy_single_workspace"])
  assert.ok(sql.includes(index),"No removal of physical SQL 002 gate allowed");
 assert.match(sql,/CREATE TABLE IF NOT EXISTS platform_staff_identity_links/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS platform_workspace_staff_roles/);
 assert.match(sql,/REVOKE ALL ON/);
 assert.doesNotMatch(sql,/DROP INDEX\s+(?:IF EXISTS\s+)?platform_legacy_/i);
 assert.doesNotMatch(sql,/\bINSERT INTO\s+platform_org_memberships/i);
});
