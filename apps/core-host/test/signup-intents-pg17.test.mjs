import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import pg from "pg";
import {PgSignupReservationStore} from "../dist/signup-control-intents.js";

const raw=process.env.SYNDES_IAM04_PG_URL;
const permitted=process.env.SYNDES_IAM04_DISPOSABLE_PG==="IAM04B_PG17_ONLY"&&
 raw==="postgresql://postgres:ci-only-disposable-iam-ci@127.0.0.1:32779/postgres";
const file=rel=>readFile(new URL(rel,import.meta.url),"utf8");

test("UC-SIGNUP-01B Control PG17: founder-bound first-tenant reservation and immutable audit",{
 skip:!permitted&&"requires the existing disposable IAM04B PostgreSQL 17",
},async()=>{
 const inspected=JSON.parse(execFileSync("docker",["inspect","syndes-iam04b-pg17-ci"],{
  encoding:"utf8",timeout:5000}))[0];
 assert.equal(inspected.Config.Image,"postgres:17-alpine");
 assert.equal(inspected.Config.Labels["syndes.disposable"],"iam04b-pg17");
 const root=new pg.Client({connectionString:raw});
 await root.connect();
 const name="signup_test_"+randomUUID().replaceAll("-","").slice(0,16);
 const next=()=>{const u=new URL(raw);u.pathname="/"+name;return u.toString()};
 let db;
 try{
  await root.query(`DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles
   WHERE rolname='syndes_core') THEN CREATE ROLE syndes_core NOLOGIN; END IF; END$$`);
  await root.query('CREATE DATABASE "'+name+'"');
  db=new pg.Client({connectionString:next()});await db.connect();
  await db.query(await file("../../../infra/postgres/bootstrap/control.schema"));
  const schema=await file("../../../infra/postgres/bootstrap/control-signup-intents-candidate.schema");
  await db.query(schema);
  await db.query(schema);
  assert.equal((await db.query(`SELECT has_table_privilege('syndes_core',
   'public.platform_signup_intents','SELECT') AS allowed`)).rows[0].allowed,false);
  assert.equal((await db.query(`SELECT has_table_privilege('syndes_signup_operator',
   'public.platform_signup_intents','SELECT') AS allowed`)).rows[0].allowed,true);
  assert.equal((await db.query(`SELECT has_table_privilege('syndes_signup_operator',
   'public.tenant_registry','INSERT') AS allowed`)).rows[0].allowed,false);
  const founder=randomUUID(),intruder=randomUUID(),requestId=randomUUID();
  const rawInput={requestId,founderId:founder,accountName:"Company",
    organizationName:"First Org",workspaceName:"First Workspace"};
  await db.query("SET ROLE syndes_signup_operator");
  const store=new PgSignupReservationStore(db,async id=>id===founder);
  const first=await store.reserve(rawInput);
  assert.equal(first.state,"reserved");
  assert.ok(first.tenantId!==first.organizationId&&first.workspaceId!==first.organizationId);
  assert.deepEqual(await store.reserve(rawInput),first);
  assert.deepEqual(await store.get(requestId,founder),first);
  await assert.rejects(store.reserve({...rawInput,organizationName:"Altered"}));
  await assert.rejects(store.reserve({...rawInput,founderId:intruder}));
  await assert.rejects(store.get(requestId,intruder));
  const auditBefore=await db.query(`SELECT revision,event FROM public.platform_signup_intent_audit
    WHERE request_id=$1 ORDER BY revision`,[requestId]);
  assert.deepEqual(auditBefore.rows,[{revision:"1",event:"reserved"}]);
  await store.markReconcileRequired(requestId,founder);
  assert.equal((await store.get(requestId,founder)).state,"reconcile_required");
  await store.markReconcileRequired(requestId,founder);
  const auditAfter=await db.query(`SELECT revision,event FROM public.platform_signup_intent_audit
    WHERE request_id=$1 ORDER BY revision`,[requestId]);
  assert.deepEqual(auditAfter.rows,[{revision:"1",event:"reserved"},
    {revision:"2",event:"reconcile_required"}]);
  await assert.rejects(store.markReconcileRequired(requestId,intruder));
  const keycloakOrganizationId=randomUUID();
  await store.markReady(requestId,founder,keycloakOrganizationId);
  const ready=await store.get(requestId,founder);
  assert.equal(ready.state,"ready");
  assert.equal(ready.keycloakOrganizationId,keycloakOrganizationId);
  await store.markReady(requestId,founder,keycloakOrganizationId);
  await assert.rejects(store.markReady(requestId,founder,randomUUID()));
  await assert.rejects(store.markReconcileRequired(requestId,founder));
  const auditFinal=await db.query(`SELECT revision,event
    FROM public.platform_signup_intent_audit WHERE request_id=$1 ORDER BY revision`,[requestId]);
  assert.deepEqual(auditFinal.rows,[
   {revision:"1",event:"reserved"},
   {revision:"2",event:"reconcile_required"},
   {revision:"3",event:"ready"},
  ]);
  assert.equal(ready.keycloakAlias,
    "syndes-"+first.tenantId.replaceAll("-","")+"-"+requestId.replaceAll("-",""));

  await assert.rejects(db.query("DELETE FROM public.platform_signup_intents"));
  await db.query("RESET ROLE");
  const registry=(await db.query("SELECT count(*)::int AS n FROM tenant_registry")).rows[0].n;
  assert.equal(registry,0,"Reservation never provisions a tenant or grants membership");
  console.log("UC_SIGNUP01B_PG17_FOUNDER_IDEMPOTENT_CONTROL_RESERVATION_PASS");
 }finally{
  if(db)await db.end().catch(()=>{});
  await root.query('DROP DATABASE IF EXISTS "'+name+'" WITH (FORCE)').catch(()=>{});
  await root.end();
 }
});
