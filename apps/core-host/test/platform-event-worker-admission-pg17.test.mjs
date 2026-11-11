import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import pg from "pg";
import {TenantPgProvider,expectedTenantDatabase} from "../dist/tenant-database.js";
import {TenantEventPublisher} from "../dist/platform-event-publisher.js";
import {TenantEventDispatcher} from "../dist/platform-event-dispatcher.js";
import {TenantEventWorkerAdmission,PgEventWorkerScope}
 from "../dist/platform-event-worker-admission.js";

const url=process.env.SYNDES_EVENTS_PG_URL;
const safe=(()=>{
 if(!url||process.env.SYNDES_EVENTS_DISPOSABLE!=="EVENTS_TEST_ONLY")return false;
 try{const u=new URL(url);
  return u.protocol==="postgresql:"&&["localhost","127.0.0.1"].includes(u.hostname)
   &&u.pathname==="/postgres"&&u.username==="postgres"
   &&u.password.startsWith("ci-only-disposable-");
 }catch{return false}
})();
const file=path=>readFile(new URL(path,import.meta.url),"utf8");
const dsn=name=>{const u=new URL(url);u.pathname="/"+name;return u.toString()};

test("PG17 disposable: Control/FGA/organization gates protect real dispatcher effects",
 {skip:!safe},async t=>{
 const admin=new pg.Client({connectionString:url});
 await admin.connect();
 const version=(await admin.query("SELECT current_setting('server_version_num')::int AS n")).rows[0].n;
 assert.ok(version>=170000&&version<180000);
 const tenantA=randomUUID(),tenantB=randomUUID(),
  orgA=randomUUID(),orgB=randomUUID(),wsA=randomUUID();
 const databases=new Map(),created=[];
 try{
  for(const [tenant,organization] of [[tenantA,orgA],[tenantB,orgB]]){
   const name=expectedTenantDatabase(tenant).database_name;
   await admin.query('CREATE DATABASE "'+name+'"');
   created.push(name);
   const pool=new pg.Pool({connectionString:dsn(name),max:5});
   databases.set(tenant,pool);
   await pool.query(await file("../../../modules/organizations/sql/001_account_hierarchy.sql"));
   await pool.query(
    "INSERT INTO platform_organizations(tenant_id,id,display_name,is_default) VALUES($1,$2,'Fixture Org',true)",
    [tenant,organization]);
   if(tenant===tenantA)
    await pool.query(
     "INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug,is_default) VALUES($1,$2,$3,'Fixture','fixture',true)",
     [tenant,wsA,organization]);
   await pool.query(await file("../sql/001_platform_events.sql"));
   await pool.query(await file("../sql/002_event_type_version_consistency.sql"));
   await pool.query("CREATE TABLE fixture_worker_effects(event_id uuid PRIMARY KEY,tenant_id uuid NOT NULL)");
  }
  const provider=new TenantPgProvider({db:{query:async(_q,args)=>({
   rows:[expectedTenantDatabase(args[0])],rowCount:1,
  })}});
  for(const [tenant,pool] of databases)provider.pools.set(tenant,{pool,last:Date.now()});
  const scope=new PgEventWorkerScope(provider);
  const actor={kind:"service",id:"syndes-events-service"};
  const publisher=new TenantEventPublisher();
  let moduleEnabled=false,grantAllowed=true,authDown=false;
  const control={canExecuteModule:async({actor:q,tenantId,moduleId})=>{
   assert.equal(q.kind,"service");assert.equal(q.id,actor.id);
   assert.equal(moduleId,"inbox");
   if(authDown)throw Error("Control is unavailable");
   return moduleEnabled&&tenantId===tenantA;
  }};
  const fga={canProcess:async q=>{
   assert.equal(q.actor.id,actor.id);
   assert.equal(q.actor.kind,"service");
   assert.equal(q.tenantId,tenantA);
   assert.equal(q.organizationId,orgA);
   assert.equal(q.workspaceId,wsA);
   return grantAllowed;
  }};
  const admission=new TenantEventWorkerAdmission(control,scope,fga,actor.id);
  const worker=new TenantEventDispatcher(provider,[{
   id:"inbox.fixture",moduleId:"inbox",types:["crm.person.created.v1"],
   handle:async(tx,event)=>{
    await tx.query("INSERT INTO fixture_worker_effects(event_id,tenant_id) VALUES($1,$2)",
      [event.eventId,event.tenantId]);
   },
  }],admission,actor.id);
  const publish=async(tenantId,organizationId,workspaceId=null)=>{
   const personId=randomUUID();
   return (await provider.withTransaction(tenantId,tx=>publisher.publish(tx,{
    tenantId,organizationId,workspaceId,
    type:"crm.person.created.v1",producer:"crm",aggregateType:"person",
    aggregateId:personId,idempotencyKey:"worker:"+personId,
    correlationId:personId,payload:{personId},
   }))).eventId;
  };
  const delivery=async(tenantId,eventId)=>{
   const result=await databases.get(tenantId).query(
    "SELECT state,attempts FROM platform_events.event_deliveries WHERE event_id=$1",
    [eventId]);
   return result.rows[0];
  };
  const effects=async(tenantId)=>Number((await databases.get(tenantId).query(
   "SELECT count(*)::int AS n FROM fixture_worker_effects")).rows[0].n);

  await t.test("module not ENABLED suspends, preserves attempts and business facts",async()=>{
   const eventId=await publish(tenantA,orgA,wsA);
   assert.equal(await worker.routePending(tenantA),1);
   assert.equal(await worker.processNext(tenantA),"suspended");
   assert.deepEqual(await delivery(tenantA,eventId),{state:"suspended",attempts:0});
   assert.equal(await effects(tenantA),0);
   moduleEnabled=true;
   await databases.get(tenantA).query(
    "UPDATE platform_events.event_deliveries SET next_attempt_at=clock_timestamp() WHERE event_id=$1",
    [eventId]);
   assert.equal(await worker.processNext(tenantA),"delivered");
   assert.equal(await effects(tenantA),1);
   assert.equal((await delivery(tenantA,eventId)).state,"completed");
  });

  await t.test("Control outage suspends and recovers without duplicate effect",async()=>{
   const eventId=await publish(tenantA,orgA,wsA);
   await worker.routePending(tenantA);
   authDown=true;
   assert.equal(await worker.processNext(tenantA),"suspended");
   assert.equal(await effects(tenantA),1);
   authDown=false;
   await databases.get(tenantA).query(
    "UPDATE platform_events.event_deliveries SET next_attempt_at=clock_timestamp() WHERE event_id=$1",
    [eventId]);
   assert.equal(await worker.processNext(tenantA),"delivered");
   assert.equal(await effects(tenantA),2);
   assert.equal(await worker.processNext(tenantA),"empty");
  });

  await t.test("explicit FGA denial is terminal; no effect or implicit bypass",async()=>{
   const eventId=await publish(tenantA,orgA,wsA);
   await worker.routePending(tenantA);
   grantAllowed=false;
   assert.equal(await worker.processNext(tenantA),"dead");
   assert.equal(await effects(tenantA),2);
   assert.equal((await delivery(tenantA,eventId)).state,"dead");
   grantAllowed=true;
  });

  await t.test("archived organization and workspace deny before business effect",async()=>{
   const eventId=await publish(tenantA,orgA,wsA);
   await worker.routePending(tenantA);
   await databases.get(tenantA).query("UPDATE platform_workspaces SET status='archived' WHERE id=$1",[wsA]);
   assert.equal(await worker.processNext(tenantA),"dead");
   assert.equal(await effects(tenantA),2);
   await databases.get(tenantA).query("UPDATE platform_workspaces SET status='active' WHERE id=$1",[wsA]);
   const orgEvent=await publish(tenantA,orgA,wsA);
   await worker.routePending(tenantA);
   await databases.get(tenantA).query("UPDATE platform_organizations SET status='archived' WHERE id=$1",[orgA]);
   assert.equal(await worker.processNext(tenantA),"dead");
   assert.equal(await effects(tenantA),2);
   assert.equal((await delivery(tenantA,orgEvent)).state,"dead");
  });

  await t.test("second tenant database receives no other tenant effect",async()=>{
   assert.equal(await worker.routePending(tenantB),0);
   assert.equal(await effects(tenantB),0);
   assert.equal(await effects(tenantA),2);
   assert.equal(await scope.active(tenantA,orgB,null),false);
  });
  await provider.onModuleDestroy();
 }finally{
  for(const [,pool] of databases)await pool.end().catch(()=>{});
  for(const name of created){
   await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1",[name]);
   await admin.query('DROP DATABASE "'+name+'"');
  }
  await admin.end();
 }
});
