/** Actual PgModuleInstaller plan/apply/verify against isolated PostgreSQL17.
 * Control Catalog is synthetic in-memory; its separate real-DB tests live
 * in module-installer-pg17.test.mjs. No staging/operational databases used.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {createHash,randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import pg from "pg";
import {PgModuleInstaller} from "../dist/module-installer.js";
import {loadTrustedServiceRelease} from "../dist/service-release.js";

const URL_RAW=process.env.SYNDES_FUNNEL_PG_URL;
const allowed=(()=>{
 if(!URL_RAW||process.env.SYNDES_FUNNEL_DISPOSABLE!=="FUNNEL_PG17_ONLY")return false;
 try{
  const u=new URL(URL_RAW);
  return u.protocol==="postgresql:"&&u.hostname==="127.0.0.1"&&
    u.port==="32772"&&u.pathname==="/postgres"&&u.username==="postgres"&&
    u.password.startsWith("ci-only-disposable-funnel-");
 }catch{return false;}
})();
const sha=x=>createHash("sha256").update(x).digest("hex");
const imageDigest="sha256:"+sha("sm03c-synthetic-container-build");
const urlDb=name=>{const u=new URL(URL_RAW);u.pathname="/"+name;return u.toString()};
const localFile=path=>readFile(new URL(path,import.meta.url),"utf8");
const publicMigrations=[
 "../../../modules/organizations/sql/001_account_hierarchy.sql",
 "../../../modules/organizations/sql/002_legacy_single_context_gate.sql",
 "../../../modules/core-crm/sql/001_crm_foundation.sql",
 "../../../modules/core-crm/sql/002_crm_tags_notes.sql",
 "../../../modules/core-crm/sql/003_crm_employees_channels.sql",
 "../../../modules/inbox/sql/001_inbox_foundation.sql",
 "../../../modules/whatsapp/sql/001_whatsapp_accounts.sql",
 "../../../modules/organizations/sql/003_legacy_ownership.sql",
 "../../../modules/organizations/sql/007_staff_roles_pre_release.sql",
];
const dependencies=["organizations","crm","inbox"].map(id=>{
 const sql="CREATE TABLE "+id+".fixture (id UUID PRIMARY KEY)";
 return {id,schema:id,version:"0.1.0",dependencies:[],
  imageDigest:"sha256:"+sha("synthetic-dependency-"+id),
  migrations:[{id:"001_fixture",version:"0.1.0",sql,checksum:sha(sql),
   expectedRelations:[id+".fixture"]}]};
});
function receipt(release){
 return sha(JSON.stringify({
  moduleId:release.id,version:release.version,schema:release.schema,
  imageDigest:release.imageDigest,
  migrations:release.migrations.map(x=>({
   id:x.id,version:x.version,checksum:x.checksum,
  })),
 }));
}
function fakeControl(releases,allowedTenant){
 // The real Control catalog/attestation has its own PG17 suite.
 // This typed stub only admits a fixed approved synthetic release/version.
 return {async query(sql,params=[]){
  if(sql.includes("FROM public.tenant_registry AS t")){
   return {rows:releases.flatMap(item=>
    (item.dependencies.length?item.dependencies:[null]).map(dep=>({
     module_id:item.id,version:item.version,
     schema_name:item.schema,dependency_id:dep,
    })))};
  }
  if(sql.includes("SELECT t.database_name,t.role_name,i.state")){
   const [tenantId,moduleId]=params;
   if(tenantId!==allowedTenant||moduleId!=="service")return {rows:[]};
   const suffix=tenantId.replaceAll("-","");
   return {rows:[{database_name:"syndes_tenant_"+suffix,
    role_name:"syndes_t_"+suffix,state:"requested",target_version:"0.3.0",
    installed_version:null,verification_digest:null}]};
  }
  if(sql.includes("FROM public.module_catalog_dependencies d")){
   const [tenantId,moduleId,version]=params;
   if(tenantId!==allowedTenant||moduleId!=="service"||version!=="0.3.0")
    return {rows:[]};
   return {rows:dependencies.map(dep=>({
    dependency_id:dep.id,entitlement_state:"granted",entitlement_current:true,
    install_state:"enabled",installed_version:dep.version,
    verification_digest:receipt(dep),
   })).sort((a,b)=>a.dependency_id.localeCompare(b.dependency_id))};
  }
  throw Error("Unexpected Control query in synthetic installer fixture");
 }};
}
async function prepareTenant(pool){
 for(const file of publicMigrations)await pool.query(await localFile(file));
 await pool.query(await localFile("../../../infra/postgres/bootstrap/tenant-module-ledger.schema"));
 for(const dep of dependencies){
  await pool.query("CREATE SCHEMA "+dep.schema);
  await pool.query(dep.migrations[0].sql);
  await pool.query(`INSERT INTO _syndes.module_migrations
    (module_id,migration_id,version,checksum,image_digest)
    VALUES($1,$2,$3,$4,$5)`,[
     dep.id,dep.migrations[0].id,dep.version,
     dep.migrations[0].checksum,dep.imageDigest,
    ]);
 }
}

test("SM-03C: official PgModuleInstaller applies actual Service SQL atomically on PG17",
 {skip:!allowed},async t=>{
 const actual=JSON.parse(execFileSync("docker",[
  "inspect","syndes-funnel-pg17-20261111"],{encoding:"utf8",timeout:5000}))[0];
 assert.equal(actual.Config.Image,"postgres:17-alpine");
 assert.equal(actual.Config.Labels["syndes.disposable"],"funnel-mvp-pg17");
 assert.ok(actual.NetworkSettings.Ports["5432/tcp"].some(
  p=>p.HostIp==="127.0.0.1"&&p.HostPort==="32772"));
 const admin=new pg.Client({connectionString:URL_RAW});
 await admin.connect();
 const A=randomUUID(),B=randomUUID(),C=randomUUID();
 const name=x=>"syndes_tenant_"+x.replaceAll("-","");
 const names=[A,B,C].map(name),created=[],pools=new Map();
 try{
  const v=(await admin.query("SELECT current_setting('server_version_num')::int AS n")).rows[0].n;
  assert.ok(v>=170000&&v<180000);
  for(const id of [A,B,C]){
   const database=name(id);
   await admin.query('CREATE DATABASE "'+database+'"');
   created.push(database);
   pools.set(id,new pg.Pool({connectionString:urlDb(database),max:3}));
  }
  await prepareTenant(pools.get(A));
  await prepareTenant(pools.get(C));
  const release=await loadTrustedServiceRelease(imageDigest);
  const releases=[...dependencies,release];
  const control=fakeControl(releases,A);
  const resolve=async id=>{
   const pool=pools.get(id);
   if(!pool)throw Error("Unknown synthetic tenant");
   return pool;
  };
  const installer=new PgModuleInstaller(control,resolve,releases);
  await t.test("plan is read-only, fails closed for tenant B and no physical namespace yet",async()=>{
   const plan=await installer.plan(A,"service");
   assert.equal(plan.schema,"service");
   assert.equal(plan.version,"0.3.0");
   assert.deepEqual(plan.migrations.map(x=>x.status),["pending","pending","pending"]);
   assert.equal((await pools.get(A).query(
    "SELECT to_regclass('service.service_attendances') AS ref")).rows[0].ref,null);
   assert.equal((await pools.get(A).query(
    "SELECT count(*)::int AS n FROM _syndes.module_migrations WHERE module_id='service'"
    )).rows[0].n,0);
   await assert.rejects(installer.plan(B,"service"),/Access denied/);
   await assert.rejects(installer.plan(A,"service-management"),/Access denied/);
  });
  await t.test("apply real SQL + PG-catalog-only search path, verify ledger and immutable checksums",async()=>{
   const out=await installer.apply(A,"service");
   assert.equal(out.controlState,"requested","No fake Control activation");
   assert.equal(out.verified.verified,true);
   assert.equal(out.verified.imageDigest,imageDigest);
   assert.deepEqual(out.plan.migrations.map(x=>x.status),[
    "applied","applied","applied"]);
   const sql=pools.get(A);
   assert.equal((await sql.query(
    "SELECT count(*)::int AS n FROM _syndes.module_migrations WHERE module_id='service'"
    )).rows[0].n,3);
   const rows=(await sql.query(`SELECT migration_id,checksum,image_digest
    FROM _syndes.module_migrations WHERE module_id='service'
    ORDER BY migration_id`)).rows;
   assert.deepEqual(rows.map(x=>x.checksum),release.migrations.map(x=>x.checksum));
   assert.ok(rows.every(x=>x.image_digest===imageDigest));
   assert.equal((await sql.query(
    "SELECT to_regclass('service.service_attendances') IS NOT NULL AS has"
    )).rows[0].has,true);
   assert.equal((await sql.query(
    "SELECT to_regclass('public.service_attendances') AS ref")).rows[0].ref,null);
   assert.equal((await sql.query(
    "SELECT to_regprocedure('service.service_team_can_read(uuid,uuid,uuid,uuid,text)') IS NOT NULL AS has"
    )).rows[0].has,true);
   assert.equal((await sql.query(`SELECT count(*)::int AS n
     FROM pg_catalog.pg_indexes WHERE schemaname='service'
     AND indexname='service_attendance_inspector_conversation_idx'`)).rows[0].n,1);
   const verified=await installer.verify(A,"service");
   assert.equal(verified.receipt,out.verified.receipt);
  });
  await t.test("retry is idempotent, ledger stays three rows, other tenant remains untouched",async()=>{
   const twice=await installer.apply(A,"service");
   assert.deepEqual(twice.plan.migrations.map(x=>x.status),[
    "applied","applied","applied"]);
   assert.equal((await pools.get(A).query(
    "SELECT count(*)::int AS n FROM _syndes.module_migrations WHERE module_id='service'"
    )).rows[0].n,3);
   assert.equal((await pools.get(B).query(
    "SELECT to_regclass('service.service_attendances') AS ref")).rows[0].ref,null);
  });
  await t.test("checksum drift is rejected by real planner and verifier",async()=>{
   const pool=pools.get(A);
   const original=release.migrations[0].checksum;
   await pool.query(`UPDATE _syndes.module_migrations
    SET checksum=$1 WHERE module_id='service' AND migration_id='001_service_funnels'`,
    ["f".repeat(64)]);
   try{
    await assert.rejects(installer.verify(A,"service"),/Access denied/);
    await assert.rejects(installer.plan(A,"service"),/Access denied/);
   }finally{
    await pool.query(`UPDATE _syndes.module_migrations SET checksum=$1
      WHERE module_id='service' AND migration_id='001_service_funnels'`,[original]);
   }
   assert.equal((await installer.verify(A,"service")).verified,true);
  });
  await t.test("failed migration rolls back schema, all three ledger entries and original public tables",async()=>{
   const sql=release.migrations[2].sql+"\nSELECT 1/0;";
   const bad={...release,migrations:[
    release.migrations[0],release.migrations[1],
    {...release.migrations[2],sql,checksum:sha(sql)},
   ]};
   const faultyControl=fakeControl([...dependencies,bad],C);
   const faultyInstaller=new PgModuleInstaller(faultyControl,resolve,[
    ...dependencies,bad]);
   await assert.rejects(faultyInstaller.apply(C,"service"),e=>e.code==="22012");
   const pool=pools.get(C);
   assert.equal((await pool.query(
    "SELECT to_regclass('service.service_funnels') AS ref")).rows[0].ref,null);
   assert.equal((await pool.query(
    "SELECT count(*)::int AS n FROM _syndes.module_migrations WHERE module_id='service'"
    )).rows[0].n,0);
   assert.equal((await pool.query(
    "SELECT to_regclass('public.inbox_conversations') IS NOT NULL AS yes"
    )).rows[0].yes,true);
  });
  await t.test("tenant runtime cannot forge protected ledger or own Service tables",async()=>{
   const role="syndes_sm03c_runtime_fixture";
   await admin.query("CREATE ROLE "+role+" NOLOGIN");
   const pool=pools.get(A),client=await pool.connect();
   try{
    await client.query("SET ROLE "+role);
    await assert.rejects(client.query(
      "SELECT * FROM _syndes.module_migrations"),e=>e.code==="42501");
    await assert.rejects(client.query(
      "UPDATE service.service_attendances SET version=1"),e=>e.code==="42501");
   }finally{await client.query("RESET ROLE");client.release()}
  });
 }finally{
  for(const pool of pools.values())await pool.end().catch(()=>{});
  for(const database of created.reverse())await admin.query(
   'DROP DATABASE "'+database+'" WITH (FORCE)').catch(()=>{});
  await admin.end();
 }
});
