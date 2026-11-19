import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import pg from "pg";
import {PINNED_TENANT_TRANSACTION} from "@syndes/core-kernel";
import {PgFirstTenantOperatorInstaller} from "../dist/signup-first-tenant-installer.js";
import {PgFirstTenantSignupKeycloakLink} from "../dist/signup-initial-link.js";
import {PgSignupReservationStore} from "../dist/signup-control-intents.js";

const raw=process.env.SYNDES_IAM04_PG_URL;
const allowed=process.env.SYNDES_IAM04_DISPOSABLE_PG==="IAM04B_PG17_ONLY"&&
 raw==="postgresql://postgres:ci-only-disposable-iam-ci@127.0.0.1:32779/postgres";
const file=path=>readFile(new URL(path,import.meta.url),"utf8");
const url=name=>{const u=new URL(raw);u.pathname="/"+name;return u.toString()};

test("UC-SIGNUP-01C PG17: initial default Org/Workspace, Control registry and SQL002 preserved",{
 skip:!allowed&&"requires labeled disposable IAM04B PostgreSQL17",
},async()=>{
 const inspected=JSON.parse(execFileSync("docker",["inspect","syndes-iam04b-pg17-ci"],{
  encoding:"utf8",timeout:5000}))[0];
 assert.equal(inspected.Config.Image,"postgres:17-alpine");
 assert.equal(inspected.Config.Labels["syndes.disposable"],"iam04b-pg17");
 const id=randomUUID(),suffix=id.replaceAll("-","");
 const cdb="signup_ctrl_"+suffix.slice(0,16),tdb="syndes_tenant_"+suffix;
 const intent={requestId:randomUUID(),founderId:randomUUID(),
  tenantId:id,organizationId:randomUUID(),workspaceId:randomUUID(),
  accountName:"Alpha",organizationName:"Alpha Company",
  workspaceName:"Operations",keycloakAlias:"syndes-"+suffix+"-"+randomUUID().replaceAll("-",""),
  keycloakOrganizationId:null,state:"reserved",revision:1};
 const root=new pg.Client({connectionString:raw});await root.connect();
 let control,tenant;
 try{
  await root.query(`DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles
   WHERE rolname='syndes_core') THEN CREATE ROLE syndes_core NOLOGIN; END IF; END$$`);
  await root.query('CREATE DATABASE "'+cdb+'"');
  await root.query('CREATE DATABASE "'+tdb+'"');
  control=new pg.Client({connectionString:url(cdb)});await control.connect();
  tenant=new pg.Pool({connectionString:url(tdb),max:2});
  await control.query(await file("../../../infra/postgres/bootstrap/control.schema"));
  await control.query(await file("../../../infra/postgres/bootstrap/control-iam-org-links.schema"));
  await control.query(await file("../../../infra/postgres/bootstrap/control-signup-intents-candidate.schema"));
  await control.query(await file("../../../infra/postgres/bootstrap/control-signup-initial-link-candidate.schema"));
  await control.query(await file("../../../infra/postgres/bootstrap/control-signup-finalize-candidate.schema"));
  await tenant.query(await file("../../../modules/organizations/sql/001_account_hierarchy.sql"));
  await tenant.query(await file("../../../modules/organizations/sql/002_legacy_single_context_gate.sql"));
  await control.query(`INSERT INTO tenant_registry(
   tenant_id,database_name,role_name,state) VALUES($1,$2,$3,'provisioned')`,
   [id,tdb,"syndes_t_"+suffix]);
  const trusted={
   resolve:async tenantId=>{
    assert.equal(tenantId,id);
    return {tenantId,query:async(q,v)=>tenant.query(q,[...v])};
   },
   withTransaction:async(tenantId,fn)=>{
    assert.equal(tenantId,id);
    const c=await tenant.connect();try{
     await c.query("BEGIN");
     const out=await fn(Object.freeze({
      tenantId,[PINNED_TENANT_TRANSACTION]:true,
      query:async(q,v)=>c.query(q,[...v]),
     }));
     await c.query("COMMIT");return out;
    }catch(e){await c.query("ROLLBACK");throw e}
    finally{c.release()}
   },
  };
  let ensured=0;
  const provisioner={ensure:async()=>{ensured++},verify:async()=>true};
  const adapter=new PgFirstTenantOperatorInstaller(control,trusted,provisioner);
  assert.equal(await adapter.verifyDatabase(intent),false);
  await adapter.ensureDatabase(intent);
  assert.equal(await adapter.verifyDatabase(intent),true);
  assert.equal(await adapter.verifyActive(intent),false);
  await adapter.ensureDefaultContext(intent);
  await adapter.ensureDefaultContext(intent);

  // The operator binds exact Keycloak Organization while tenant is PROVISIONED.
  await control.query(`INSERT INTO platform_signup_intents(
    request_id,founder_id,tenant_id,organization_id,workspace_id,
    account_name,organization_name,workspace_name,keycloak_alias)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
   [intent.requestId,intent.founderId,intent.tenantId,intent.organizationId,
    intent.workspaceId,intent.accountName,intent.organizationName,
    intent.workspaceName,"syndes-"+intent.tenantId.replaceAll("-","")+"-"+
    intent.requestId.replaceAll("-","")]);
  const kcId=randomUUID(),link=new PgFirstTenantSignupKeycloakLink(control,"syndes");
  assert.equal(await link.verify(intent,kcId),false);
  await link.ensure(intent,kcId);
  assert.equal(await link.verify(intent,kcId),true);
  await link.ensure(intent,kcId);
  await assert.rejects(link.ensure(intent,randomUUID()));
  await assert.rejects(link.ensure({...intent,founderId:randomUUID()},kcId));
  assert.equal((await control.query(`SELECT count(*)::int AS n
   FROM platform_keycloak_org_link_audit WHERE request_id=$1`,
   [intent.requestId])).rows[0].n,1);

  assert.equal(await adapter.verifyDefaultContext(intent),true);
  const counts=(await tenant.query(`SELECT
   (SELECT count(*)::int FROM platform_organizations) AS orgs,
   (SELECT count(*)::int FROM platform_workspaces) AS workspaces,
   (SELECT count(*)::int FROM platform_org_memberships) AS orgmembers,
   (SELECT count(*)::int FROM platform_workspace_memberships) AS wsmembers,
   (SELECT count(*)::int FROM platform_org_audit) AS audit`)).rows[0];
  assert.deepEqual(counts,{orgs:1,workspaces:1,orgmembers:1,wsmembers:1,audit:1});
  assert.equal((await tenant.query(`SELECT count(*)::int AS n FROM pg_indexes
   WHERE schemaname='public' AND indexname IN(
    'platform_legacy_single_organization','platform_legacy_single_workspace')`)).rows[0].n,2);
  await assert.rejects(adapter.ensureDefaultContext(
   {...intent,organizationId:randomUUID()}));
  await assert.rejects(adapter.ensureDatabase({...intent,founderId:randomUUID()}));
  const store=new PgSignupReservationStore(control,
    async principal=>principal===intent.founderId,control);
  assert.equal((await store.get(intent.requestId,intent.founderId)).state,"reserved");
  // Control tenant activation + durable READY are ONE Control SQL transaction.
  await store.markReady(intent.requestId,intent.founderId,kcId);
  assert.equal(await adapter.verifyActive(intent),true);
  assert.equal((await store.get(intent.requestId,intent.founderId)).state,"ready");
  await store.markReady(intent.requestId,intent.founderId,kcId);
  await assert.rejects(store.markReady(intent.requestId,intent.founderId,randomUUID()));
  assert.equal(await link.verify(intent,kcId),true);
  await assert.rejects(link.ensure(intent,kcId));
  const finalAudit=(await control.query(`SELECT revision,event
    FROM platform_signup_intent_audit WHERE request_id=$1 ORDER BY revision`,
    [intent.requestId])).rows;
  assert.deepEqual(finalAudit,[{revision:"2",event:"ready"}]);
  await control.query("UPDATE tenant_registry SET state='suspended' WHERE tenant_id=$1",[id]);
  assert.equal(await adapter.verifyActive(intent),false);
  await assert.rejects(store.markReady(intent.requestId,intent.founderId,kcId));
  assert.equal(ensured,2,"No implicit alternate tenant provision from foreign founder");
  console.log("UC_SIGNUP01C_PG17_FIRST_CONTEXT_SQL002_CONTROL_ACTIVATION_PASS");
 }finally{
  if(tenant)await tenant.end().catch(()=>{});
  if(control)await control.end().catch(()=>{});
  for(const name of [tdb,cdb])await root.query('DROP DATABASE IF EXISTS "'+name+'" WITH (FORCE)').catch(()=>{});
  await root.end();
 }
});
