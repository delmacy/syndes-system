import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import pg from "pg";

const url=process.env.SYNDES_EVENTS_PG_URL;
const safe=(()=>{
 if(!url||process.env.SYNDES_EVENTS_DISPOSABLE!=="EVENTS_TEST_ONLY")return false;
 try{const u=new URL(url);
  return u.protocol==="postgresql:"&&["127.0.0.1","localhost"].includes(u.hostname)&&
   u.pathname==="/postgres"&&u.username==="postgres"&&
   u.password.startsWith("ci-only-disposable-");
 }catch{return false}
})();
const fixtureDb="syndes_control"; // name is inside the GUARDED disposable PostgreSQL only
const fixtures=[
 "control-module-catalog.schema",
 "control-module-lifecycle.schema",
 "control-module-attestation.schema",
 "control-module-activation.schema",
 "control-module-manager-readonly.schema",
 "control-module-events.schema",
];
const load=(name)=>readFile(new URL("../../../infra/postgres/bootstrap/"+name,import.meta.url),"utf8");
const dsn=(name)=>{const u=new URL(url);u.pathname="/"+name;return u.toString()};

test("PG17 disposable Control DB: module audit produces durable transactional control events",
 {skip:!safe},async t=>{
 const admin=new pg.Client({connectionString:url});await admin.connect();
 const version=await admin.query("SELECT current_setting('server_version_num')::int AS n");
 assert.ok(version.rows[0].n>=170000&&version.rows[0].n<180000);
 const existing=await admin.query("SELECT 1 FROM pg_database WHERE datname=$1",[fixtureDb]);
 if(existing.rows.length)throw Error("Disposable control DB fixture already exists; refusing reuse");
 let created=false,pool;
 try{
  await t.test("migration refuses the postgres database before any DDL",async()=>{
   const before=(await admin.query(
    "SELECT to_regnamespace('control_events')::text AS schema_name")).rows[0].schema_name;
   await assert.rejects(admin.query(await load("control-module-events.schema")),
    error=>error.code==="42501");
   const after=(await admin.query(
    "SELECT to_regnamespace('control_events')::text AS schema_name")).rows[0].schema_name;
   assert.equal(after,before);
  });
  await admin.query('CREATE DATABASE "'+fixtureDb+'"');created=true;
  pool=new pg.Pool({connectionString:dsn(fixtureDb),max:4});
  await pool.query(`
   DO $role$ BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='syndes_core')
    THEN CREATE ROLE syndes_core NOLOGIN; END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='syndes_master_api')
    THEN CREATE ROLE syndes_master_api NOLOGIN NOINHERIT; END IF;
   END $role$;
  `);
  await pool.query(await load("control.schema"));
  for(const file of fixtures){
   try{await pool.query(await load(file))}
   catch(error){throw Error("Control fixture migration "+file+" failed: "+error.message,{cause:error})}
  }
  await pool.query(await load("control-module-events.schema"));
  const count=async(table)=>Number((await pool.query(
   "SELECT count(*)::int AS n FROM "+table)).rows[0].n);
  const tenantA=randomUUID(),tenantB=randomUUID();
  for(const tenantId of [tenantA,tenantB]){
   const stem=tenantId.replaceAll("-","");
   await pool.query(`
    INSERT INTO tenant_registry(tenant_id,database_name,role_name,state)
    VALUES($1,$2,$3,'active')
   `,[tenantId,"syndes_tenant_"+stem,"syndes_t_"+stem]);
  }
  await pool.query(
   "INSERT INTO public.module_catalog(module_id,schema_name) VALUES('crm','crm')");
  await pool.query(`
   INSERT INTO public.module_catalog_versions
    (module_id,version,approved,approved_at,approved_by)
   VALUES('crm','1.0.0',true,clock_timestamp(),'fixture')
  `);
  const entitlement=async(tenant,action,request=randomUUID())=>
   pool.query(`
    SELECT public.transition_tenant_module_entitlement(
     $1::uuid,'crm',$2,$3::uuid,'fixture-operator','Control event integration test'
    ) AS result
   `,[tenant,action,request]);
  const install=async(tenant,action,request=randomUUID())=>
   pool.query(`
    SELECT public.transition_tenant_module_install_intent(
     $1::uuid,'crm','1.0.0',$2,$3::uuid,'fixture-operator','Control event integration test'
    ) AS result
   `,[tenant,action,request]);

  await t.test("schema is replayable and trigger is installed exactly once",async()=>{
   assert.equal((await pool.query(`
    SELECT count(*)::int AS n FROM pg_trigger
    WHERE tgrelid='public.tenant_module_audit'::regclass
      AND tgname='control_module_audit_event_outbox' AND NOT tgisinternal
   `)).rows[0].n,1);
   assert.equal(await count("control_events.outbox_events"),0);
  });

  await t.test("entitlement audit and outbox event commit together with minimal JSON",async()=>{
   const request=randomUUID();
   const r=await entitlement(tenantA,"grant",request);
   assert.equal(r.rows[0].result,"granted");
   assert.equal(await count("public.tenant_module_audit"),1);
   assert.equal(await count("control_events.outbox_events"),1);
   const ev=(await pool.query("SELECT * FROM control_events.outbox_events")).rows[0];
   assert.equal(ev.tenant_id,tenantA);
   assert.equal(ev.module_id,"crm");
   assert.equal(ev.event_type,"platform.module.entitlement.changed.v1");
   assert.equal(ev.event_version,1);
   assert.equal(ev.operation,"entitlement.grant");
   assert.equal(ev.result_state,"granted");
   assert.equal(ev.correlation_id,request);
   assert.deepEqual(Object.keys(ev.payload),["auditEventId"]);
   const source=(await pool.query("SELECT event_id::text FROM public.tenant_module_audit")).rows[0];
   assert.equal(ev.payload.auditEventId,source.event_id);
   assert.ok(!JSON.stringify(ev.payload).includes("fixture-operator"));
   assert.ok(!JSON.stringify(ev.payload).includes("Control event integration test"));

   await entitlement(tenantA,"grant",request);
   assert.equal(await count("control_events.outbox_events"),1);
   assert.equal(await count("public.tenant_module_audit"),1);
  });

  await t.test("installation and suspension produce separate facts, same audit owner",async()=>{
   const i=await install(tenantA,"request");
   assert.equal(i.rows[0].result,"requested");
   const s=await entitlement(tenantA,"suspend");
   assert.equal(s.rows[0].result,"suspended");
   assert.equal(await count("public.tenant_module_audit"),3);
   assert.equal(await count("control_events.outbox_events"),3);
   const events=(await pool.query(`
    SELECT event_type,operation,result_state FROM control_events.outbox_events
    WHERE tenant_id=$1::uuid ORDER BY created_at,audit_event_id
   `,[tenantA])).rows;
   assert.deepEqual(events.map(x=>x.operation),[
    "entitlement.grant","installation.request","entitlement.suspend",
   ]);
   assert.equal(events[1].event_type,"platform.module.installation.changed.v1");
   assert.equal(events[2].result_state,"suspended");
  });

  await t.test("outbox failure rolls back entitlement, append-only audit and event",async()=>{
   await pool.query(`
    ALTER TABLE control_events.outbox_events
     ADD CONSTRAINT fixture_fail_publish CHECK(false) NOT VALID
   `);
   try{
    await assert.rejects(entitlement(tenantA,"resume"),error=>error.code==="23514");
    assert.equal(await count("public.tenant_module_audit"),3);
    assert.equal(await count("control_events.outbox_events"),3);
    const state=(await pool.query(
     "SELECT state FROM public.tenant_module_entitlements WHERE tenant_id=$1 AND module_id='crm'",
     [tenantA])).rows[0].state;
    assert.equal(state,"suspended");
   }finally{
    await pool.query("ALTER TABLE control_events.outbox_events DROP CONSTRAINT fixture_fail_publish");
   }
  });

  await t.test("failed transaction after transition rolls back domain and event",async()=>{
   const client=await pool.connect();
   try{
    await client.query("BEGIN");
    await client.query(`
     SELECT public.transition_tenant_module_entitlement(
      $1::uuid,'crm','resume',$2::uuid,'fixture-operator','Explicit rollback test'
     )
    `,[tenantA,randomUUID()]);
    await client.query("ROLLBACK");
   }finally{client.release()}
   assert.equal(await count("public.tenant_module_audit"),3);
   assert.equal(await count("control_events.outbox_events"),3);
  });

  await t.test("different tenant subject is explicit in the global Control ledger",async()=>{
   await entitlement(tenantB,"grant");
   assert.equal((await pool.query(
    "SELECT count(*)::int AS n FROM control_events.outbox_events WHERE tenant_id=$1",
    [tenantA])).rows[0].n,3);
   assert.equal((await pool.query(
    "SELECT count(*)::int AS n FROM control_events.outbox_events WHERE tenant_id=$1",
    [tenantB])).rows[0].n,1);
   assert.equal(await count("control_events.outbox_events"),4);
  });

  await t.test("control event subject cannot mismatch its immutable audit tenant",async()=>{
   const row=(await pool.query(
    "SELECT event_id::text,audit_event_id::text FROM control_events.outbox_events WHERE tenant_id=$1 LIMIT 1",
    [tenantA])).rows[0];
   const client=await pool.connect();
   try{
    await client.query("BEGIN");
    await client.query("DELETE FROM control_events.outbox_events WHERE event_id=$1",[row.event_id]);
    await assert.rejects(client.query(`
     INSERT INTO control_events.outbox_events
      (event_id,audit_event_id,tenant_id,module_id,event_type,event_version,
       aggregate_key,operation,result_state,correlation_id,payload)
     VALUES($1::uuid,$2::bigint,$3::uuid,'crm',
      'platform.module.entitlement.changed.v1',1,'crm','entitlement.grant',
      'granted',$4::uuid,$5::jsonb)
    `,[randomUUID(),row.audit_event_id,tenantB,randomUUID(),
      JSON.stringify({auditEventId:row.audit_event_id})]),error=>error.code==="23503");
   }finally{
    await client.query("ROLLBACK");client.release();
   }
   assert.equal(await count("control_events.outbox_events"),4);
  });

  await t.test("two consumer delivery records remain independently idempotent",async()=>{
   const ev=(await pool.query(
    "SELECT event_id::text FROM control_events.outbox_events WHERE tenant_id=$1 LIMIT 1",
    [tenantA])).rows[0].event_id;
   for(const consumer of ["control.policy-cache","control.manager-readmodel"]){
    await pool.query(`
     INSERT INTO control_events.event_deliveries(event_id,consumer_id)
     VALUES($1::uuid,$2)
    `,[ev,consumer]);
    await pool.query(`
     INSERT INTO control_events.consumer_inbox(event_id,consumer_id)
     VALUES($1::uuid,$2) ON CONFLICT DO NOTHING
    `,[ev,consumer]);
    await pool.query(`
     UPDATE control_events.event_deliveries
     SET state='completed',completed_at=clock_timestamp()
     WHERE event_id=$1::uuid AND consumer_id=$2
    `,[ev,consumer]);
   }
   assert.equal(await count("control_events.event_deliveries"),2);
   assert.equal(await count("control_events.consumer_inbox"),2);
   await assert.rejects(pool.query(`
    INSERT INTO control_events.event_deliveries(event_id,consumer_id)
    VALUES($1::uuid,'control.policy-cache')
   `,[ev]),error=>error.code==="23505");
  });

  await t.test("least-privilege module operator transitions via authorized definer, not direct DML",async()=>{
   const before=await count("control_events.outbox_events");
   const client=await pool.connect();
   try{
    await client.query("SET ROLE syndes_module_operator");
    await assert.rejects(client.query("SELECT * FROM control_events.outbox_events"),
     error=>error.code==="42501");
    const outcome=await client.query(`
     SELECT public.transition_tenant_module_entitlement(
      $1::uuid,'crm','resume',$2::uuid,'fixture-operator','least privilege transition'
     ) AS state
    `,[tenantA,randomUUID()]);
    assert.equal(outcome.rows[0].state,"granted");
   }finally{await client.query("RESET ROLE");client.release()}
   assert.equal(await count("control_events.outbox_events"),before+1);
  });

  await t.test("unprivileged Control role cannot read or forge event ledger",async()=>{
   const client=await pool.connect();
   try{
    await client.query("SET ROLE syndes_core");
    await assert.rejects(client.query("SELECT * FROM control_events.outbox_events"),
     error=>error.code==="42501");
    await assert.rejects(client.query(`
     INSERT INTO control_events.event_deliveries(event_id,consumer_id)
     VALUES($1::uuid,'control.forged')
    `,[randomUUID()]),error=>error.code==="42501");
   }finally{await client.query("RESET ROLE");client.release()}
  });

 }finally{
  if(pool)await pool.end().catch(()=>{});
  if(created){
   await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1",[fixtureDb]);
   await admin.query('DROP DATABASE "'+fixtureDb+'"');
  }
  await admin.end();
 }
});
