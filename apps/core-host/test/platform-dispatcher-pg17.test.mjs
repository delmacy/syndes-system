import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import pg from "pg";
import {TenantPgProvider,expectedTenantDatabase} from "../dist/tenant-database.js";
import {TenantEventPublisher} from "../dist/platform-event-publisher.js";
import {TenantEventDispatcher,PermanentEventError,retryDelaySeconds} from "../dist/platform-event-dispatcher.js";

const url=process.env.SYNDES_EVENTS_PG_URL;
const safe=(()=>{
 if(!url||process.env.SYNDES_EVENTS_DISPOSABLE!=="EVENTS_TEST_ONLY")return false;
 try{const u=new URL(url);
  return u.protocol==="postgresql:"&&["localhost","127.0.0.1"].includes(u.hostname)&&
   u.pathname==="/postgres"&&u.username==="postgres"&&u.password.startsWith("ci-only-disposable-");
 }catch{return false}
})();
const file=(path)=>readFile(new URL(path,import.meta.url),"utf8");
const dsn=(name)=>{const u=new URL(url);u.pathname="/"+name;return u.toString()};
const pub=new TenantEventPublisher();

test("bounded backoff and invalid attempts",()=>{
 assert.equal(retryDelaySeconds(1),5);assert.equal(retryDelaySeconds(2),10);
 assert.equal(retryDelaySeconds(8),640);assert.equal(retryDelaySeconds(15),3600);
 assert.throws(()=>retryDelaySeconds(0));
});
test("PG17 disposable: independent deliveries, worker identity, leases and crashes",
 {skip:!safe},async t=>{
 const admin=new pg.Client({connectionString:url});await admin.connect();
 const version=await admin.query("SELECT current_setting('server_version_num')::int AS n");
 assert.ok(version.rows[0].n>=170000&&version.rows[0].n<180000);
 const A=randomUUID(),B=randomUUID(),orgA=randomUUID(),orgB=randomUUID(),wsA=randomUUID();
 const pools=new Map(),created=[];
 try{
  for(const id of [A,B]){const name=expectedTenantDatabase(id).database_name;
   await admin.query('CREATE DATABASE "'+name+'"');created.push(name);
   const pool=new pg.Pool({connectionString:dsn(name),max:6});
   pools.set(id,pool);
   await pool.query(await file("../../../modules/organizations/sql/001_account_hierarchy.sql"));
   const org=id===A?orgA:orgB;
   await pool.query("INSERT INTO platform_organizations(tenant_id,id,display_name,is_default) VALUES($1,$2,'Test',true)",[id,org]);
   if(id===A)await pool.query("INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug,is_default) VALUES($1,$2,$3,'Default','default',true)",[id,wsA,orgA]);
   await pool.query(await file("../sql/001_platform_events.sql"));
   await pool.query("CREATE TABLE demo_effects(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL,organization_id uuid NOT NULL,event_id uuid NOT NULL,consumer_id text NOT NULL)");
  }
  const provider=new TenantPgProvider({db:{query:async(_sql,args)=>({rows:[expectedTenantDatabase(args[0])],rowCount:1})}});
  for(const tenant of [A,B])provider.pools.set(tenant,{pool:pools.get(tenant),last:Date.now()});
  const effects=async(tenant,ev)=>Number((await pools.get(tenant).query(
   "SELECT count(*)::int AS n FROM demo_effects WHERE event_id=$1",[ev])).rows[0].n);
  const delivery=async(tenant,id,consumer)=>(
   await pools.get(tenant).query("SELECT * FROM platform_events.event_deliveries WHERE tenant_id=$1 AND event_id=$2 AND consumer_id=$3",[tenant,id,consumer])).rows[0];
  const publish=async(tenant,org,workspace=null)=>{
   const person=randomUUID(),fact={
    tenantId:tenant,organizationId:org,workspaceId:workspace,
    type:"crm.person.created.v1",producer:"crm",aggregateType:"person",
    aggregateId:person,idempotencyKey:"created:"+person,correlationId:person,payload:{personId:person},
   };
   return (await provider.withTransaction(tenant,tx=>pub.publish(tx,fact))).eventId;
  };
  const faults={before:new Set(),during:new Set(),ack:new Set(),permanent:new Set()};
  const newConsumer=(id,moduleId)=>({
   id,moduleId,types:["crm.person.created.v1"],
   handle:async(tx,ev)=>{
    if(faults.before.has(ev.eventId))throw Error("before");
    await tx.query("INSERT INTO demo_effects(tenant_id,organization_id,event_id,consumer_id) VALUES($1,$2,$3,$4)",
     [ev.tenantId,ev.organizationId,ev.eventId,id]);
    if(faults.during.has(ev.eventId))throw Error("during");
    if(faults.permanent.has(ev.eventId))throw new PermanentEventError();
    if(faults.ack.has(ev.eventId))
     await tx.query("SELECT set_config('syndes.fail_ack','yes',true)",[]);
   },
  });
  const subscribers=[newConsumer("inbox.projection","inbox"),newConsumer("crm.audit","crm")];
  let gate="enabled",recorded=[];
  const guard={authorize:async q=>{
   recorded.push(q);
   if(gate==="error")throw Error("Control DB outage");
   return gate;
  }};
  const dispatcher=()=>new TenantEventDispatcher(provider,subscribers,guard,"syndes-worker-test");
  const worker=dispatcher();
  await pools.get(A).query(`
   CREATE FUNCTION platform_events.test_ack_failure() RETURNS trigger LANGUAGE plpgsql AS $$
   BEGIN
    IF NEW.state='completed' AND current_setting('syndes.fail_ack',true)='yes'
     THEN RAISE EXCEPTION 'test acknowledgement outage'; END IF;
    RETURN NEW;
   END; $$;
   CREATE TRIGGER test_fail_ack BEFORE UPDATE ON platform_events.event_deliveries
   FOR EACH ROW EXECUTE FUNCTION platform_events.test_ack_failure();
  `);
  await t.test("two consumers confirm independently and service principal is explicit",async()=>{
   const id=await publish(A,orgA,wsA);
   assert.equal(await worker.routePending(A),1);
   assert.equal(await worker.processNext(A),"delivered");
   assert.equal(await worker.processNext(A),"delivered");
   assert.equal(await worker.processNext(A),"empty");
   assert.equal(await effects(A,id),2);
   assert.equal((await pools.get(A).query("SELECT count(*)::int AS n FROM platform_events.consumer_inbox WHERE event_id=$1",[id])).rows[0].n,2);
   assert.equal((await delivery(A,id,"inbox.projection")).state,"completed");
   assert.equal((await delivery(A,id,"crm.audit")).state,"completed");
   assert.ok(recorded.every(r=>r.actor.kind==="service"&&r.actor.id==="syndes-worker-test"&&r.tenantId===A&&r.organizationId===orgA&&r.workspaceId===wsA));
  });
  await t.test("replay after completed inbox never repeats a business effect",async()=>{
   const id=await publish(A,orgA);
   await worker.routePending(A);
   await worker.processNext(A);await worker.processNext(A);
   assert.equal(await effects(A,id),2);
   await pools.get(A).query("UPDATE platform_events.event_deliveries SET state='retry',completed_at=NULL,next_attempt_at=clock_timestamp() WHERE tenant_id=$1 AND event_id=$2 AND consumer_id='crm.audit'",[A,id]);
   assert.equal(await worker.processNext(A),"already_processed");
   assert.equal(await effects(A,id),2);
  });
  await t.test("failure before, during effect and before acknowledgement all retry atomically",async()=>{
   for(const phase of ["before","during","ack"]){
    const id=await publish(A,orgA);await worker.routePending(A);
    // Force CRM audit to run only after Inbox completes in deterministic claim order.
    faults[phase].add(id);
    assert.equal(await worker.processNext(A),"retry");
    assert.equal(await effects(A,id),0);
    const states=(await pools.get(A).query("SELECT state FROM platform_events.event_deliveries WHERE tenant_id=$1 AND event_id=$2",[A,id])).rows.map(r=>r.state);
    assert.ok(states.includes("retry"));
    faults[phase].delete(id);
    await pools.get(A).query("UPDATE platform_events.event_deliveries SET next_attempt_at=clock_timestamp() WHERE tenant_id=$1 AND event_id=$2 AND state='retry'",[A,id]);
    for(let i=0;i<3;i++)await worker.processNext(A);
    assert.equal(await effects(A,id),2);
   }
  });
  await t.test("disabled module retains event without exhausting retries",async()=>{
   const id=await publish(A,orgA);await worker.routePending(A);
   gate="suspended";
   assert.equal(await worker.processNext(A),"suspended");
   const d=(await pools.get(A).query("SELECT state,attempts FROM platform_events.event_deliveries WHERE tenant_id=$1 AND event_id=$2 AND state='suspended'",[A,id])).rows[0];
   assert.equal(d.attempts,0);
   assert.equal(await effects(A,id),0);
   gate="enabled";
   await pools.get(A).query("UPDATE platform_events.event_deliveries SET next_attempt_at=clock_timestamp() WHERE tenant_id=$1 AND event_id=$2",[A,id]);
   for(let i=0;i<2;i++)assert.equal(await worker.processNext(A),"delivered");
   assert.equal(await effects(A,id),2);
  });
  await t.test("authorization outage fails closed but preserves the event for recovery",async()=>{
   const id=await publish(A,orgA);await worker.routePending(A);
   gate="error";
   assert.equal(await worker.processNext(A),"suspended");
   assert.equal(await worker.processNext(A),"suspended");
   assert.equal(await effects(A,id),0);
   const d=(await pools.get(A).query("SELECT state,last_error_class,attempts FROM platform_events.event_deliveries WHERE tenant_id=$1 AND event_id=$2 AND state='suspended'",[A,id])).rows[0];
   assert.equal(d.last_error_class,"suspended");
   assert.equal(d.attempts,0);
   gate="enabled";
   await pools.get(A).query("UPDATE platform_events.event_deliveries SET next_attempt_at=clock_timestamp() WHERE tenant_id=$1 AND event_id=$2",[A,id]);
   await worker.processNext(A);await worker.processNext(A);
   assert.equal(await effects(A,id),2);
  });
  await t.test("explicit authorization denial is terminal without effect",async()=>{
   const id=await publish(A,orgA);await worker.routePending(A);
   gate="denied";
   assert.equal(await worker.processNext(A),"dead");
   assert.equal(await worker.processNext(A),"dead");
   assert.equal(await effects(A,id),0);
   const d=(await pools.get(A).query(
    "SELECT count(*)::int AS n FROM platform_events.event_deliveries WHERE tenant_id=$1 AND event_id=$2 AND state='dead' AND last_error_class='unauthorized'",
    [A,id])).rows[0];
   assert.equal(d.n,2);
   gate="enabled";
  });
  await t.test("temporarily missing registered handler suspends and later resumes",async()=>{
   const id=await publish(A,orgA);await worker.routePending(A);
   const emptyWorker=new TenantEventDispatcher(provider,[],guard,"syndes-worker-test");
   assert.equal(await emptyWorker.processNext(A),"suspended");
   assert.equal(await emptyWorker.processNext(A),"suspended");
   assert.equal(await effects(A,id),0);
   await pools.get(A).query(
    "UPDATE platform_events.event_deliveries SET next_attempt_at=clock_timestamp() WHERE tenant_id=$1 AND event_id=$2",
    [A,id]);
   await worker.processNext(A);await worker.processNext(A);
   assert.equal(await effects(A,id),2);
  });
  await t.test("permanent handler failure does not retry indefinitely",async()=>{
   const id=await publish(A,orgA);await worker.routePending(A);
   faults.permanent.add(id);
   assert.equal(await worker.processNext(A),"dead");
   assert.equal(await worker.processNext(A),"dead");
   assert.equal(await effects(A,id),0);
   faults.permanent.delete(id);
  });
  await t.test("unsupported persisted version is quarantined, not lost",async()=>{
   const person=randomUUID(),evt=randomUUID();
   await pools.get(A).query(`
    INSERT INTO platform_events.outbox_events(tenant_id,event_id,organization_id,
     event_type,event_version,producer,aggregate_type,aggregate_id,idempotency_key,
     correlation_id,payload) VALUES ($1,$2,$3,'crm.person.created.v2',2,'crm','person',$4,$5,$4,'{}'::jsonb)
   `,[A,evt,orgA,person,"unknown:"+person]);
   assert.equal(await worker.routePending(A),1);
   const r=await pools.get(A).query("SELECT routing_state FROM platform_events.outbox_events WHERE event_id=$1",[evt]);
   assert.equal(r.rows[0].routing_state,"unsupported");
   assert.equal((await pools.get(A).query("SELECT count(*)::int AS n FROM platform_events.event_deliveries WHERE event_id=$1",[evt])).rows[0].n,0);
  });
  await t.test("expired lease recovered after worker restart",async()=>{
   const id=await publish(A,orgA);await worker.routePending(A);
   await pools.get(A).query(`
    UPDATE platform_events.event_deliveries
    SET state='processing',attempts=1,lease_owner=$3::uuid,
      lease_until=clock_timestamp()-interval '2 seconds'
    WHERE tenant_id=$1 AND event_id=$2 AND consumer_id='crm.audit'
   `,[A,id,randomUUID()]);
   const restarted=dispatcher();
   await restarted.processNext(A);await restarted.processNext(A);
   assert.equal(await effects(A,id),2);
   assert.equal((await delivery(A,id,"crm.audit")).state,"completed");
  });
  await t.test("two dispatchers concurrently claim once per consumer and tenant",async()=>{
   const ids=await Promise.all(Array.from({length:12},()=>publish(A,orgA)));
   assert.equal(await worker.routePending(A,100),12);
   const second=dispatcher();
   for(let round=0;round<12;round++){
    await Promise.all(Array.from({length:8},(_,i)=>(i%2?second:worker).processNext(A)));
    if((await pools.get(A).query("SELECT count(*)::int AS n FROM demo_effects WHERE event_id=ANY($1::uuid[])",[ids])).rows[0].n===24)break;
   }
   for(const id of ids)assert.equal(await effects(A,id),2);
   assert.equal((await pools.get(A).query("SELECT count(*)::int AS n FROM platform_events.event_deliveries WHERE event_id=ANY($1::uuid[]) AND state='completed'",[ids])).rows[0].n,24);
  });
  await t.test("no delivery or business effect crosses tenant database",async()=>{
   const idB=await publish(B,orgB);
   assert.equal(await worker.routePending(A),0);
   assert.equal(await effects(A,idB),0);
   assert.equal(await worker.routePending(B),1);
   await worker.processNext(B);await worker.processNext(B);
   assert.equal(await effects(B,idB),2);
   assert.equal(await effects(A,idB),0);
  });
  await t.test("registration requires unique trusted modules and explicit authorization",()=>{
   assert.throws(()=>new TenantEventDispatcher(provider,subscribers,{authorize:async()=>true},""),/identity/);
   assert.throws(()=>new TenantEventDispatcher(provider,[...subscribers,subscribers[0]],guard,"worker"),/duplicate/);
   assert.throws(()=>new TenantEventDispatcher(provider,[{...subscribers[0],id:"unowned"}],guard,"worker"),/registration/);
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
