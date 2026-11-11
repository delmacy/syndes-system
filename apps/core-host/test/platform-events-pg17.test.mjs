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
 try{
  const p=new URL(url);
  return p.protocol==="postgresql:"&&["127.0.0.1","localhost"].includes(p.hostname)&&
   p.pathname==="/postgres"&&p.username==="postgres"&&p.password.startsWith("ci-only-disposable-");
 }catch{return false}
})();
const dbUrl=(name)=>{const u=new URL(url);u.pathname="/"+name;return u.toString()};
const event=(t,org,person,key=randomUUID())=>({
 tenantId:t,organizationId:org,type:"crm.person.created.v1",producer:"crm",
 aggregateType:"person",aggregateId:person,idempotencyKey:key,
 correlationId:person,payload:{personId:person},
});
const sql=(relative)=>readFile(new URL(relative,import.meta.url),"utf8");

test("PG17 disposable: atomic event publisher, identity, org and tenant isolation",
 {skip:!safe},async t=>{
 const admin=new pg.Client({connectionString:url});await admin.connect();
 const version=await admin.query("SELECT current_setting('server_version_num')::int AS n");
 assert.ok(version.rows[0].n>=170000&&version.rows[0].n<180000);
 const A=randomUUID(),B=randomUUID(),orgA=randomUUID(),orgB=randomUUID();
 const otherOrg=randomUUID(),wsA=randomUUID();
 const names=[expectedTenantDatabase(A).database_name,expectedTenantDatabase(B).database_name];
 const pools=new Map(),created=[];
 try{
  for(const name of names){
   await admin.query('CREATE DATABASE "'+name+'"');
   created.push(name);
  }
  const orgSql=await sql("../../../modules/organizations/sql/001_account_hierarchy.sql");
  const eventSql=await sql("../sql/001_platform_events.sql");
  for(const [tenant,org] of [[A,orgA],[B,orgB]]){
   const pool=new pg.Pool({connectionString:dbUrl(expectedTenantDatabase(tenant).database_name),max:3});
   pools.set(tenant,pool);
   await pool.query(orgSql);
   await pool.query("INSERT INTO platform_organizations(tenant_id,id,display_name,is_default) VALUES($1,$2,'Test fixture',true)",[tenant,org]);
   if(tenant===A){
    await pool.query("INSERT INTO platform_organizations(tenant_id,id,display_name) VALUES($1,$2,'Other org')",[tenant,otherOrg]);
    await pool.query("INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug,is_default) VALUES($1,$2,$3,'Main','main',true)",[tenant,wsA,org]);
   }
   await pool.query(eventSql);
   await pool.query(eventSql);
   await pool.query("CREATE TABLE demo_people(tenant_id uuid NOT NULL,organization_id uuid NOT NULL,id uuid PRIMARY KEY,name text NOT NULL)");
  }
  const dbRegistry={query:async(_sql,values)=>({rows:[expectedTenantDatabase(values[0])],rowCount:1})};
  const provider=new TenantPgProvider({db:dbRegistry});
  for(const tenant of [A,B])provider.pools.set(tenant,{pool:pools.get(tenant),last:Date.now()});
  const publisher=new TenantEventPublisher();
  const count=async(tenant,table)=>Number((await pools.get(tenant).query('SELECT count(*)::int AS n FROM '+table)).rows[0].n);
  await t.test("one COMMIT creates business entity plus outbox row",async()=>{
   const person=randomUUID();
   await provider.withTransaction(A,async tx=>{
    await tx.query("INSERT INTO demo_people(tenant_id,organization_id,id,name) VALUES($1,$2,$3,'Fixture')",[A,orgA,person]);
    await publisher.publish(tx,event(A,orgA,person,"created:"+person));
   });
   assert.equal(await count(A,"demo_people"),1);
   assert.equal(await count(A,"platform_events.outbox_events"),1);
  });
  await t.test("domain error rolls back domain and outbox",async()=>{
   const person=randomUUID();
   await assert.rejects(provider.withTransaction(A,async tx=>{
    await tx.query("INSERT INTO demo_people(tenant_id,organization_id,id,name) VALUES($1,$2,$3,'Fixture')",[A,orgA,person]);
    await publisher.publish(tx,event(A,orgA,person,"created:"+person));
    throw Error("forced business failure");
   }),/forced business failure/);
   assert.equal(await count(A,"demo_people"),1);
   assert.equal(await count(A,"platform_events.outbox_events"),1);
  });
  await t.test("outbox failure rolls back the business change",async()=>{
   const person=randomUUID();
   await assert.rejects(provider.withTransaction(A,async tx=>{
    await tx.query("INSERT INTO demo_people(tenant_id,organization_id,id,name) VALUES($1,$2,$3,'Fixture')",[A,orgA,person]);
    await publisher.publish(tx,event(A,randomUUID(),person));
   }),e=>e.code==="23503");
   assert.equal(await count(A,"demo_people"),1);
   assert.equal(await count(A,"platform_events.outbox_events"),1);
  });
  await t.test("organization/workspace ownership is enforced at the database",async()=>{
   const person=randomUUID();
   await assert.rejects(provider.withTransaction(A,tx=>publisher.publish(tx,{
    ...event(A,orgA,person),workspaceId:randomUUID(),
   })),e=>e.code==="23503");
   await assert.rejects(provider.withTransaction(A,tx=>publisher.publish(tx,{
    ...event(A,otherOrg,person),workspaceId:wsA,
   })),e=>e.code==="23503");
   assert.equal(await count(A,"platform_events.outbox_events"),1);
  });
  await t.test("idempotent retries do not duplicate and reject conflicting facts",async()=>{
   const person=randomUUID(),key="once:"+person;
   const first=await provider.withTransaction(A,tx=>publisher.publish(tx,event(A,orgA,person,key)));
   const second=await provider.withTransaction(A,tx=>publisher.publish(tx,event(A,orgA,person,key)));
   assert.equal(first.inserted,true);assert.equal(second.inserted,false);
   assert.equal(first.eventId,second.eventId);
   await assert.rejects(provider.withTransaction(A,tx=>publisher.publish(tx,event(A,orgA,randomUUID(),key))),/collision/);
   assert.equal(await count(A,"platform_events.outbox_events"),2);
  });
  await t.test("same idempotency key submitted concurrently creates one event",async()=>{
   const person=randomUUID(),payload=event(A,orgA,person,"parallel:"+person);
   const decisions=await Promise.all(Array.from({length:5},()=>provider.withTransaction(A,tx=>publisher.publish(tx,payload))));
   assert.equal(decisions.filter(x=>x.inserted).length,1);
   assert.equal(new Set(decisions.map(x=>x.eventId)).size,1);
   assert.equal(await count(A,"platform_events.outbox_events"),3);
  });
  await t.test("cross-tenant transaction mismatch fails closed",async()=>{
   await assert.rejects(provider.withTransaction(A,tx=>publisher.publish(tx,event(B,orgB,randomUUID()))),/mismatch/);
   assert.equal(await count(B,"platform_events.outbox_events"),0);
   provider.pools.set(B,{pool:pools.get(A),last:Date.now()});
   await assert.rejects(provider.withTransaction(B,async()=>true),/database identity mismatch/);
   provider.pools.set(B,{pool:pools.get(B),last:Date.now()});
  });
  await t.test("role without ledger privileges cannot publish",async()=>{
   const client=await pools.get(A).connect();
   try{
    await client.query("SET ROLE pg_monitor");
    await assert.rejects(client.query("INSERT INTO platform_events.outbox_events(tenant_id,event_id,organization_id,event_type,event_version,producer,aggregate_type,aggregate_id,idempotency_key,correlation_id,payload) VALUES($1,$2,$3,'crm.person.created.v1',1,'crm','person',$4,'forbidden',$4,'{}')",[A,randomUUID(),orgA,randomUUID()]),e=>e.code==="42501");
   }finally{await client.query("RESET ROLE");client.release()}
  });
  await provider.onModuleDestroy();
 }finally{
  await Promise.allSettled([...pools.values()].map(p=>p.end()));
  for(const name of created.reverse()){
   await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1",[name]);
   await admin.query('DROP DATABASE "'+name+'"');
  }
  await admin.end();
 }
});
