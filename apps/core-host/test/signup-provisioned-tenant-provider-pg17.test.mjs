/** PG17 integration: real isolated tenant OWNER role while Control registry
 * remains PROVISIONED; never open a production tenant or a runtime Host pool.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import pg from "pg";
import {PgSignupProvisionedTenantProvider} from "../dist/signup-provisioned-tenant-provider.js";
import {PgFirstTenantOperatorInstaller} from "../dist/signup-first-tenant-installer.js";

const raw=process.env.SYNDES_IAM04_PG_URL;
const allowed=process.env.SYNDES_IAM04_DISPOSABLE_PG==="IAM04B_PG17_ONLY"&&
 raw==="postgresql://postgres:ci-only-disposable-iam-ci@127.0.0.1:32779/postgres";
const file=p=>readFile(new URL(p,import.meta.url),"utf8");
const dbUrl=(database,user="postgres",password="ci-only-disposable-iam-ci")=>{
 const u=new URL(raw);u.pathname="/"+database;u.username=user;u.password=password;return u.toString();
};
test("UC-SIGNUP-01C: real PG17 reserved tenant SQL context via tenant-owner, not runtime active gate",{
 skip:!allowed&&"requires labeled disposable IAM04B PG17",
},async()=>{
 const inspection=JSON.parse(execFileSync("docker",[
  "inspect","syndes-iam04b-pg17-ci"],{encoding:"utf8",timeout:5000}))[0];
 assert.equal(inspection.Config.Image,"postgres:17-alpine");
 assert.equal(inspection.Config.Labels["syndes.disposable"],"iam04b-pg17");
 const id=randomUUID(),suffix=id.replaceAll("-",""),
  tenantDb="syndes_tenant_"+suffix,tenantRole="syndes_t_"+suffix,
  controlDb="signup_pending_ctrl_"+suffix.slice(0,16),
  tenantPass="ci-only-signup-provisioned-"+suffix;
 const intent={requestId:randomUUID(),tenantId:id,founderId:randomUUID(),
  organizationId:randomUUID(),workspaceId:randomUUID(),
  accountName:"Customer",organizationName:"First Org",workspaceName:"First Workspace",
  keycloakAlias:"syndes-"+suffix+"-"+randomUUID().replaceAll("-"),
  keycloakOrganizationId:null,state:"reserved",revision:1};
 const admin=new pg.Client({connectionString:raw});await admin.connect();
 let control,provider,tenant;
 let roleCreated=false,tenantCreated=false,controlCreated=false;
 try{
  await admin.query(`DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles
   WHERE rolname='syndes_core') THEN CREATE ROLE syndes_core NOLOGIN; END IF;END$$`);
  // PostgreSQL formats the trusted ephemeral role/password identifiers.
  const createRole=await admin.query(
   "SELECT format('CREATE ROLE %I LOGIN PASSWORD %L',$1::text,$2::text) AS command",
   [tenantRole,tenantPass]);
  await admin.query(createRole.rows[0].command);
  roleCreated=true;
  await admin.query('CREATE DATABASE "'+tenantDb+'" OWNER "'+tenantRole+'"');
  tenantCreated=true;
  await admin.query('CREATE DATABASE "'+controlDb+'"');
  controlCreated=true;
  control=new pg.Client({connectionString:dbUrl(controlDb)});await control.connect();
  await control.query(await file("../../../infra/postgres/bootstrap/control.schema"));
  await control.query(await file("../../../infra/postgres/bootstrap/control-signup-intents-candidate.schema"));
  await control.query(`INSERT INTO tenant_registry(tenant_id,database_name,role_name,state)
   VALUES($1,$2,$3,'provisioned')`,[id,tenantDb,tenantRole]);
  await control.query(`INSERT INTO tenant_memberships(tenant_id,principal_id)
   VALUES($1,$2)`,[id,intent.founderId]);
  await control.query(`INSERT INTO platform_signup_intents(
   request_id,founder_id,tenant_id,organization_id,workspace_id,
   account_name,organization_name,workspace_name,keycloak_alias)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[
    intent.requestId,intent.founderId,intent.tenantId,intent.organizationId,
    intent.workspaceId,intent.accountName,intent.organizationName,
    intent.workspaceName,"syndes-"+suffix+"-"+intent.requestId.replaceAll("-",""),
   ]);
  let opened=0;
  provider=new PgSignupProvisionedTenantProvider(intent,control,{
   open:async(db,role)=>{
    assert.equal(db,tenantDb);assert.equal(role,tenantRole);opened++;
    return new pg.Pool({connectionString:dbUrl(db,role,tenantPass),max:2});
   },
  });
  tenant=await provider.resolve(id);
  assert.equal((await tenant.query(
   "SELECT current_database() AS db,current_user AS role",[])).rows[0].role,tenantRole);
  assert.equal(opened,1);
  await assert.rejects(provider.resolve(randomUUID()));
  await tenant.query(await file("../../../modules/organizations/sql/001_account_hierarchy.sql"),[]);
  await tenant.query(await file("../../../modules/organizations/sql/002_legacy_single_context_gate.sql"),[]);
  const installer=new PgFirstTenantOperatorInstaller(control,provider,{
   ensure:async()=>{},verify:async()=>true,
  });
  assert.equal(await installer.verifyDatabase(intent),true);
  await installer.ensureDefaultContext(intent);
  assert.equal(await installer.verifyDefaultContext(intent),true);
  await installer.ensureDefaultContext(intent);
  assert.equal((await tenant.query(
   "SELECT count(*)::int AS n FROM platform_organizations",[])).rows[0].n,1);
  await control.query("UPDATE tenant_registry SET state='suspended' WHERE tenant_id=$1",[id]);
  await assert.rejects(provider.resolve(id));
  await assert.rejects(installer.ensureDefaultContext(intent));
  await control.query("UPDATE tenant_registry SET state='active' WHERE tenant_id=$1",[id]);
  await assert.rejects(provider.resolve(id),
   "Active tenant alone without matching signup READY is forbidden");
  await control.query("UPDATE platform_signup_intents SET state='ready' WHERE request_id=$1",
   [intent.requestId]);
  assert.ok(await provider.resolve(id));
  console.log("UC_SIGNUP01C_PG17_PROVISIONED_TENANT_OWNER_CONTEXT_DENY_PASS");
 }finally{
  if(provider)await provider.close().catch(()=>{});
  if(control)await control.end().catch(()=>{});
  if(tenantCreated)await admin.query('DROP DATABASE "'+tenantDb+'"').catch(()=>{});
  if(controlCreated)await admin.query('DROP DATABASE "'+controlDb+'"').catch(()=>{});
  if(roleCreated)await admin.query('DROP ROLE "'+tenantRole+'"').catch(()=>{});
  await admin.end();
 }
});
