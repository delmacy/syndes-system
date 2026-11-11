import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import pg from "pg";
import {TenantPgProvider,expectedTenantDatabase} from "../dist/tenant-database.js";
import {TenantEventPublisher} from "../dist/platform-event-publisher.js";

const url=process.env.SYNDES_EVENTS_PG_URL;
const safe=(()=>{
 if(!url||process.env.SYNDES_EVENTS_DISPOSABLE!=="EVENTS_TEST_ONLY")return false;
 try{const u=new URL(url);
  return u.protocol==="postgresql:"&&["localhost","127.0.0.1"].includes(u.hostname)&&
   u.pathname==="/postgres"&&u.username==="postgres"&&
   u.password.startsWith("ci-only-disposable-");
 }catch{return false}
})();
const dsn=(name)=>{const u=new URL(url);u.pathname="/"+name;return u.toString()};
const read=(path)=>readFile(new URL(path,import.meta.url),"utf8");

test("PG17 disposable: real CRM schema, business insert and event in one COMMIT",
 {skip:!safe},async t=>{
 const admin=new pg.Client({connectionString:url});await admin.connect();
 const tenantId=randomUUID(),organizationId=randomUUID(),name=expectedTenantDatabase(tenantId).database_name;
 let created=false,pool;
 try{
  const version=await admin.query("SELECT current_setting('server_version_num')::int AS v");
  assert.ok(version.rows[0].v>=170000&&version.rows[0].v<180000);
  await admin.query('CREATE DATABASE "'+name+'"');
  created=true;
  pool=new pg.Pool({connectionString:dsn(name),max:3});
  await pool.query(await read("../../../modules/organizations/sql/001_account_hierarchy.sql"));
  await pool.query(await read("../../../modules/core-crm/sql/001_crm_foundation.sql"));
  await pool.query("INSERT INTO platform_organizations(tenant_id,id,display_name,is_default) VALUES($1,$2,'Fixture',true)",[tenantId,organizationId]);
  await pool.query(await read("../sql/001_platform_events.sql"));
  const provider=new TenantPgProvider({db:{query:async(_sql,vals)=>({rows:[expectedTenantDatabase(vals[0])],rowCount:1})}});
  provider.pools.set(tenantId,{pool,last:Date.now()});
  const publisher=new TenantEventPublisher();
  const event=(id,org=organizationId)=>({
   tenantId,organizationId:org,type:"crm.person.created.v1",
   producer:"crm",aggregateType:"person",aggregateId:id,
   idempotencyKey:"crm.created:"+id,correlationId:id,payload:{personId:id},
  });
  const people=async()=>Number((await pool.query("SELECT count(*)::int AS n FROM crm_people")).rows[0].n);
  const events=async()=>Number((await pool.query("SELECT count(*)::int AS n FROM platform_events.outbox_events")).rows[0].n);
  await t.test("CRM write and typed event commit atomically",async()=>{
   const personId=randomUUID();
   await provider.withTransaction(tenantId,async tx=>{
    await tx.query("INSERT INTO crm_people(tenant_id,id,name) VALUES($1,$2,'CRM fixture')",[tenantId,personId]);
    await publisher.publish(tx,event(personId));
   });
   assert.equal(await people(),1);
   assert.equal(await events(),1);
  });
  await t.test("publisher constraint violation rolls back actual crm_people write",async()=>{
   const personId=randomUUID();
   await assert.rejects(provider.withTransaction(tenantId,async tx=>{
    await tx.query("INSERT INTO crm_people(tenant_id,id,name) VALUES($1,$2,'Must not commit')",[tenantId,personId]);
    await publisher.publish(tx,event(personId,randomUUID()));
   }),e=>e.code==="23503");
   assert.equal(await people(),1);
   assert.equal(await events(),1);
  });
  await t.test("domain violation rolls back an event already inserted in transaction",async()=>{
   const personId=randomUUID();
   await assert.rejects(provider.withTransaction(tenantId,async tx=>{
    await publisher.publish(tx,event(personId));
    await tx.query("INSERT INTO crm_people(tenant_id,id,name) VALUES($1,$2,'')",[tenantId,personId]);
   }),e=>e.code==="23514");
   assert.equal(await people(),1);
   assert.equal(await events(),1);
  });
  await t.test("crashed domain transaction leaves no ghost CRM record/event",async()=>{
   const personId=randomUUID();
   await assert.rejects(provider.withTransaction(tenantId,async tx=>{
    await tx.query("INSERT INTO crm_people(tenant_id,id,name) VALUES($1,$2,'Rollback fixture')",[tenantId,personId]);
    await publisher.publish(tx,event(personId));
    throw Error("test exception");
   }),/test exception/);
   assert.equal(await people(),1);
   assert.equal(await events(),1);
  });
  await t.test("transaction commands remain prohibited while literal business text is accepted",async()=>{
   await assert.rejects(provider.withTransaction(tenantId,tx=>tx.query("COMMIT",[])),/Transaction boundary forbidden/);
   await assert.rejects(provider.withTransaction(tenantId,tx=>tx.query("SELECT 1; ROLLBACK",[])),/Transaction boundary forbidden/);
   assert.equal(await people(),1);
   assert.equal(await events(),1);
  });
  await provider.onModuleDestroy();
 }finally{
  if(pool)await pool.end().catch(()=>{});
  if(created){
   await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1",[name]);
   await admin.query('DROP DATABASE "'+name+'"');
  }
  await admin.end();
 }
});
