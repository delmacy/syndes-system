import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import pg from "pg";
import {WorkforceService} from "../dist/workforce.js";
import {AccessDeniedError} from "@syndes/core-kernel";

const url=process.env.SYNDES_ORG_TEST_PG_URL;
const T1="11111111-1111-4111-8111-111111111111";
const T2="22222222-2222-4222-8222-222222222222";
const O1="33333333-3333-4333-8333-333333333333";
const O2="44444444-4444-4444-8444-444444444444";
const W1="55555555-5555-4555-8555-555555555555";
const W2="66666666-6666-4666-8666-666666666666";
const P1="77777777-7777-4777-8777-777777777777";
const P2="88888888-8888-4888-8888-888888888888";
const E1="99999999-9999-4999-8999-999999999999";
const E2="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const personOther="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const employeeOther="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ctx=(tenantId,subject)=>({tenantId,actor:{kind:"user",id:subject}});
const own=ctx(T1,"owner-a");
const agent=ctx(T1,"agent-a");
const viewer=ctx(T1,"viewer-a");
const otherTenant=ctx(T2,"owner-b");

test("DC-2c real PostgreSQL: scoped staff identities, explicit roles, teams, FGA and SQL 002",{
 skip:!url&&"Requires disposable PostgreSQL CI service"
},async()=>{
 const u=new URL(url);
 if(!["127.0.0.1","localhost"].includes(u.hostname)||
    u.username!=="postgres"||!u.password.includes("ci-only-disposable")||
    u.pathname!=="/postgres")
  throw Error("Refusing workforce test outside disposable CI PG");
 const dbName="syndes_wf_ci_"+randomUUID().replaceAll("-","").slice(0,15);
 const admin=new pg.Client({connectionString:url});
 await admin.connect();
 let db,created=false;
 try{
  await admin.query("CREATE DATABASE "+dbName);
  created=true;
  u.pathname="/"+dbName;
  db=new pg.Client({connectionString:u.href});
  await db.connect();
  const org=await readFile(new URL("../sql/001_account_hierarchy.sql",import.meta.url),"utf8");
  const gate=await readFile(new URL("../sql/002_legacy_single_context_gate.sql",import.meta.url),"utf8");
  const crmpath=new URL("../../core-crm/sql/",import.meta.url);
  const crm1=await readFile(new URL("001_crm_foundation.sql",crmpath),"utf8");
  const crm3=await readFile(new URL("003_crm_employees_channels.sql",crmpath),"utf8");
  const staff=await readFile(new URL("../sql/007_staff_roles_pre_release.sql",import.meta.url),"utf8");
  await db.query(org);
  await db.query(gate);
  // Original CRM table definitions, executed inside this *dedicated CI DB*.
  await db.query(crm1);
  await db.query(crm3);
  // In production this column is introduced by the separate Ownership 003
  // migration (which also depends on Inbox/WhatsApp and cannot be faked here).
  await db.query("ALTER TABLE crm_people ADD COLUMN platform_organization_id UUID");
  await db.query(staff);
  await db.query(staff);

  await db.query(`
    INSERT INTO platform_organizations(tenant_id,id,display_name,is_default) VALUES
     ('${T1}','${O1}','Org A',true),
     ('${T2}','${O2}','Org B',true);
    INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug,is_default) VALUES
     ('${T1}','${W1}','${O1}','Support','support',true),
     ('${T2}','${W2}','${O2}','Support','support',true);
    INSERT INTO platform_org_memberships(tenant_id,organization_id,principal_id,role) VALUES
     ('${T1}','${O1}','owner-a','admin'),
     ('${T1}','${O1}','agent-a','editor'),
     ('${T1}','${O1}','viewer-a','viewer'),
     ('${T1}','${O1}','other-agent-a','editor'),
     ('${T2}','${O2}','owner-b','admin'),
     ('${T2}','${O2}','agent-b','editor');
    INSERT INTO platform_workspace_memberships(
      tenant_id,organization_id,workspace_id,principal_id,role) VALUES
     ('${T1}','${O1}','${W1}','owner-a','admin'),
     ('${T1}','${O1}','${W1}','agent-a','editor'),
     ('${T1}','${O1}','${W1}','viewer-a','viewer'),
     ('${T1}','${O1}','${W1}','other-agent-a','editor'),
     ('${T2}','${O2}','${W2}','owner-b','admin'),
     ('${T2}','${O2}','${W2}','agent-b','editor');
    INSERT INTO crm_people(tenant_id,id,name,platform_organization_id) VALUES
     ('${T1}','${P1}','Colaborador A','${O1}'),
     ('${T1}','${personOther}','Outro colaborador A','${O1}'),
     ('${T2}','${P2}','Colaborador B','${O2}');
    INSERT INTO crm_employees(tenant_id,id,person_id,job_title) VALUES
     ('${T1}','${E1}','${P1}','Agente'),
     ('${T1}','${employeeOther}','${personOther}','Agente'),
     ('${T2}','${E2}','${P2}','Agente');
  `);

  const checks=[],resolution=[],queries=[];
  let deny=false;
  const kernel={async execute(q,op){
   checks.push(q);
   if(deny)throw new AccessDeniedError();
   return op();
  }};
  const provider={async resolve(id){
   resolution.push(id);
   return {tenantId:id,query:async(sql,params)=>{
    queries.push({sql,params});
    const result=await db.query(sql,params);
    return {rows:result.rows,rowCount:result.rowCount};
   }};
  }};
  const service=new WorkforceService(kernel,provider);
  assert.equal(await service.myProfile(agent,O1,W1),null,
   "Technical workspace editor alone does not create a workforce role");
  assert.equal(await service.bindEmployee(own,O1,W1,E1,"agent-a"),true);
  assert.equal(await service.bindEmployee(own,O1,W1,employeeOther,"viewer-a"),true);
  assert.equal(await service.bindEmployee(otherTenant,O1,W1,E1,"agent-a"),false);
  assert.equal(await service.bindEmployee(own,O2,W2,E2,"agent-b"),false);
  assert.equal(await service.myProfile(agent,O1,W1),null,
   "Binding a CRM employee is never an automatic workspace grant");
  assert.equal(await service.assignWorkspaceRole(own,O1,W1,"agent-a","supervisor"),true);
  assert.deepEqual(await service.myProfile(agent,O1,W1),{
   employeeId:E1,businessRole:"supervisor",organizationId:O1,workspaceId:W1,
  });
  assert.equal(await service.assignWorkspaceRole(own,O1,W1,"agent-a","supervisor"),false,
   "No duplicate audit for unchanged designation");
  assert.equal(await service.assignWorkspaceRole(own,O1,W1,"viewer-a","supervisor"),false,
   "Technical viewer may not be promoted through a business label");
  assert.equal(await service.assignWorkspaceRole(own,O1,W1,"viewer-a","viewer"),true);
  assert.equal((await service.myProfile(viewer,O1,W1)).businessRole,"viewer");

  // Explicit teams organize staff; a team row never creates a workspace grant.
  const team=await service.createTeam(own,O1,W1,"Atendimento Externo");
  assert.match(team,/^[0-9a-f-]{36}$/);
  assert.equal(await service.createTeam(agent,O1,W1,"Equipe indevida"),null);
  assert.equal(await service.addTeamMember(own,O1,W1,team,"agent-a","member"),true);
  assert.equal(await service.addTeamMember(own,O1,W1,team,"agent-a","member"),false);
  assert.equal(await service.addTeamMember(otherTenant,O1,W1,team,"agent-a","lead"),false);
  assert.equal(await service.revokeWorkspaceRole(own,O1,W1,"agent-a"),true);
  assert.equal(await service.myProfile(agent,O1,W1),null,
   "Team membership must not bypass revoked workspace designation");
  assert.equal(await service.addTeamMember(own,O1,W1,team,"agent-a","lead"),false,
   "Team promotion cannot bypass a revoked designation");

  assert.equal(await service.assignWorkspaceRole(own,O1,W1,"agent-a","agent"),true);
  await db.query("UPDATE crm_employees SET active=false WHERE tenant_id=$1 AND id=$2",
   [T1,E1]);
  assert.equal(await service.myProfile(agent,O1,W1),null,
   "Inactive employee immediately loses effective staff designation");
  await db.query("UPDATE crm_employees SET active=true WHERE tenant_id=$1 AND id=$2",
   [T1,E1]);
  await db.query("UPDATE platform_org_memberships SET state='revoked' WHERE tenant_id=$1 AND organization_id=$2 AND principal_id='agent-a'",
   [T1,O1]);
  assert.equal(await service.myProfile(agent,O1,W1),null,
   "Revoked organization membership blocks role and team");
  await db.query("UPDATE platform_org_memberships SET state='active' WHERE tenant_id=$1 AND organization_id=$2 AND principal_id='agent-a'",
   [T1,O1]);

  // FGA must run before resolving tenant DB, even for read-only profile.
  deny=true;
  const count=resolution.length;
  await assert.rejects(service.myProfile(agent,O1,W1),AccessDeniedError);
  await assert.rejects(service.assignWorkspaceRole(own,O1,W1,"agent-a","supervisor"),AccessDeniedError);
  assert.equal(resolution.length,count);
  deny=false;

  await assert.rejects(service.bindEmployee(own,O1,W1,E1,"other-agent-a"),
   e=>e.code==="23505","An active employee cannot bind to two principals");
  const personOfDifferentOrg=E2;
  await assert.rejects(db.query(
   "INSERT INTO platform_staff_identity_links(tenant_id,organization_id,id,employee_id,principal_id,bound_by) VALUES($1,$2,$3,$4,$5,$6)",
   [T1,O1,randomUUID(),personOfDifferentOrg,"other-agent-a","owner-a"]),
   e=>e.code==="23503","Cross-tenant CRM employee FK");
  await assert.rejects(db.query("DELETE FROM platform_staff_access_audit WHERE tenant_id=$1",[T1]),
   e=>e.code==="42501","Workforce audit may not be deleted");
  await assert.rejects(db.query("INSERT INTO platform_organizations(tenant_id,id,display_name) VALUES($1,$2,'Other')",
   [T1,randomUUID()]),e=>e.code==="23505",
   "Physical SQL 002 gate must still forbid a second organization");
  assert.equal(checks.every(x=>x.resource==="organizations:staff"),true);
  assert.equal(checks.some(x=>x.action==="write")&&checks.some(x=>x.action==="read"),true);
  assert.equal(queries.every(x=>!x.sql.includes("platform_operator_access")),true);
  const audit=await db.query("SELECT event FROM platform_staff_access_audit WHERE tenant_id=$1 ORDER BY id",[T1]);
  const events=audit.rows.map(x=>x.event);
  for(const event of ["identity_linked","role_assigned","role_revoked",
   "role_changed","team_created","team_member_assigned"]){
   assert.ok(events.includes(event),"Missing audit event "+event);
  }
  console.log("DC-2c PostgreSQL PASS: employee Keycloak link, explicit workspace roles, teams, A/B, revocation, audit, SQL 002");
 }finally{
  if(db)await db.end();
  if(created)await admin.query("DROP DATABASE "+dbName+" WITH (FORCE)");
  await admin.end();
 }
});
