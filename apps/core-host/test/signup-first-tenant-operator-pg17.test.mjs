import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import pg from "pg";
import {FirstTenantSignupOperator} from "../dist/signup-first-tenant-operator-composition.js";

const raw=process.env.SYNDES_IAM04_PG_URL;
const allowed=process.env.SYNDES_IAM04_DISPOSABLE_PG==="IAM04B_PG17_ONLY"&&
 raw==="postgresql://postgres:ci-only-disposable-iam-ci@127.0.0.1:32779/postgres";
const sql=p=>readFile(new URL(p,import.meta.url),"utf8");
const dsn=(db,user="postgres",password="ci-only-disposable-iam-ci")=>{
 const u=new URL(raw);u.pathname="/"+db;u.username=user;u.password=password;return u.toString();
};
test("UC-SIGNUP-01C: composed first tenant PG17 Control intent, provisioned SQL002, link and atomic READY",{
 skip:!allowed&&"requires labeled disposable IAM04B PG17",
},async()=>{
 const info=JSON.parse(execFileSync("docker",["inspect","syndes-iam04b-pg17-ci"],{
  encoding:"utf8",timeout:5000}))[0];
 assert.equal(info.Config.Image,"postgres:17-alpine");
 assert.equal(info.Config.Labels["syndes.disposable"],"iam04b-pg17");
 const requestId=randomUUID(),founderId=randomUUID();
 const controlName="signup_compose_ctrl_"+randomUUID().replaceAll("-","").slice(0,16);
 let tenantId,dbName,role,password;
 const input={requestId,founderId,accountName:"Customer One",
  organizationName:"First Business",workspaceName:"Main Office"};
 const kcId=randomUUID();
 const admin=new pg.Client({connectionString:raw});await admin.connect();
 let control,operator;
 let madeControl=false,madeDb=false,madeRole=false;
 try{
  await admin.query(`DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles
   WHERE rolname='syndes_core') THEN CREATE ROLE syndes_core NOLOGIN; END IF;END$$`);
  await admin.query('CREATE DATABASE "'+controlName+'"');madeControl=true;
  control=new pg.Pool({connectionString:dsn(controlName),max:6});
  await control.query(await sql("../../../infra/postgres/bootstrap/control.schema"));
  await control.query(await sql("../../../infra/postgres/bootstrap/control-iam-org-links.schema"));
  await control.query(await sql("../../../infra/postgres/bootstrap/control-signup-intents-candidate.schema"));
  await control.query(await sql("../../../infra/postgres/bootstrap/control-signup-initial-link-candidate.schema"));
  await control.query(await sql("../../../infra/postgres/bootstrap/control-signup-finalize-candidate.schema"));
  let prepared=false,member=false,granted=false,ensures=0,opens=0;
  const operatorSource={
   open:async(db,username)=>{
    assert.equal(db,dbName);assert.equal(username,role);opens++;
    return new pg.Pool({connectionString:dsn(db,username,password),max:2});
   },
  };
  const provisioner={
   ensure:async intent=>{
    if(tenantId&&intent.tenantId!==tenantId)throw Error("Foreign tenant");
    ensures++;
    if(prepared)return;
    tenantId=intent.tenantId;
    const suffix=tenantId.replaceAll("-","");
    dbName="syndes_tenant_"+suffix;
    role="syndes_t_"+suffix;
    password="ci-only-signup-composition-"+suffix;
    const roleSql=(await admin.query(
     "SELECT format('CREATE ROLE %I LOGIN PASSWORD %L',$1::text,$2::text) AS q",
     [role,password])).rows[0].q;
    await admin.query(roleSql);madeRole=true;
    await admin.query('CREATE DATABASE "'+dbName+'" OWNER "'+role+'"');madeDb=true;
    const tenant=new pg.Client({connectionString:dsn(dbName,role,password)});
    try{
     await tenant.connect();
     await tenant.query(await sql("../../../modules/organizations/sql/001_account_hierarchy.sql"));
     await tenant.query(await sql("../../../modules/organizations/sql/002_legacy_single_context_gate.sql"));
    }finally{await tenant.end()}
    await control.query(`INSERT INTO tenant_registry(tenant_id,database_name,role_name,state)
     VALUES($1,$2,$3,'provisioned')`,[tenantId,dbName,role]);
    prepared=true;
   },
   verify:async intent=>{
    assert.equal(intent.tenantId,tenantId);
    const t=new pg.Client({connectionString:dsn(dbName,role,password)});
    try{
     await t.connect();
     const row=await t.query(`SELECT current_user AS role,
      (SELECT count(*)::int FROM pg_indexes WHERE schemaname='public'
       AND indexname IN('platform_legacy_single_organization',
                        'platform_legacy_single_workspace')) AS locks`);
     return row.rows[0].role===role&&row.rows[0].locks===2;
    }finally{await t.end()}
   },
  };
  const keycloak={
   ensureOrganization:async alias=>{
    assert.match(alias,/^syndes-[0-9a-f]{32}-[0-9a-f]{32}$/);
    return kcId;
   },
   ensureMember:async(org,founder)=>{
    assert.equal(org,kcId);assert.equal(founder,founderId);member=true;
   },
   isActiveMember:async(org,founder)=>org===kcId&&founder===founderId&&member,
  };
  const grants={
   ensureMinimum:async intent=>{
    assert.equal(intent.founderId,founderId);granted=true;
   },
   verifyMinimum:async intent=>intent.founderId===founderId&&granted,
  };
  operator=new FirstTenantSignupOperator({
   pools:{intents:control,finalizer:control,tenant:control,
    links:control,locks:control},
   tenantSource:operatorSource,provisioner,keycloak,grants,realm:"syndes",
   authorizeFounder:async id=>id===founderId,
   authorizeOperator:async i=>i.founderId===founderId,
  });
  // The official provisioning shell or operator creates the DB; the saga
  // must create the registry and first-context only when the DB is ready.
  const ready=await operator.resume(input);
  assert.equal(ready.ready,true);
  assert.equal(ready.tenantId,tenantId);
  assert.equal(ready.organizationId.length,36);
  assert.equal(ready.workspaceId.length,36);
  assert.equal((await control.query(
   "SELECT state FROM tenant_registry WHERE tenant_id=$1",[tenantId])).rows[0].state,"active");
  assert.equal((await control.query(
   "SELECT state FROM platform_signup_intents WHERE request_id=$1",[requestId])).rows[0].state,"ready");
  assert.deepEqual(await operator.resume(input),ready);
  assert.equal(ensures,1,"READY replay must not reprovision tenant");
  assert.ok(opens>=1);
  member=false;
  await assert.rejects(operator.resume(input),
   "Revoked human Keycloak Organization membership cannot be re-enrolled");
  assert.equal(member,false);
  assert.equal(ensures,1);
  member=true; // isolate the FGA-revocation negative from Keycloak revocation
  granted=false;
  await assert.rejects(operator.resume(input),
   "Missing FGA grant cannot be restored by READY replay");
  assert.equal(granted,false);
  console.log("UC_SIGNUP01C_PG17_COMPOSED_FIRST_TENANT_ATOMIC_READY_DENY_PASS");
 }finally{
  if(control)await control.end().catch(()=>{});
  if(madeDb)await admin.query('DROP DATABASE "'+dbName+'"').catch(()=>{});
  if(madeControl)await admin.query('DROP DATABASE "'+controlName+'"').catch(()=>{});
  if(madeRole)await admin.query('DROP ROLE "'+role+'"').catch(()=>{});
  await admin.end();
 }
});
