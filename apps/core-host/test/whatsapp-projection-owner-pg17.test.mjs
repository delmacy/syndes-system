import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import pg from "pg";
import {TenantPgProvider,expectedTenantDatabase} from "../dist/tenant-database.js";
import {TenantEventPublisher} from "../dist/platform-event-publisher.js";
import {WhatsAppTransactionalInboundBridge} from "../../../modules/whatsapp/dist/event-bridge.js";
import {WhatsAppInboundStore} from "../../../modules/whatsapp/dist/inbound-http.js";
import {WhatsAppInboxProjection} from "../../../modules/whatsapp/dist/dispatch.js";
import {composeTenantEventWorker} from "../dist/platform-event-worker-composition.js";

const url=process.env.SYNDES_CUTOVER_PG_URL;
const safe=(()=>{
 if(process.env.SYNDES_CUTOVER_DISPOSABLE!=="CUTOVER_PG17_ONLY"||!url)return false;
 try{
  const u=new URL(url);
  return u.protocol==="postgresql:"&&u.hostname==="127.0.0.1"&&
    u.port==="32771"&&u.pathname==="/postgres"&&
    u.username==="postgres"&&u.password.startsWith("ci-only-disposable-");
 }catch{return false}
})();
const source=path=>readFile(new URL(path,import.meta.url),"utf8");
const dsn=db=>{const u=new URL(url);u.pathname="/"+db;return u.toString()};
const migrations=[
 "../../../modules/organizations/sql/001_account_hierarchy.sql",
 "../../../modules/organizations/sql/002_legacy_single_context_gate.sql",
 "../../../modules/core-crm/sql/001_crm_foundation.sql",
 "../../../modules/core-crm/sql/002_crm_tags_notes.sql",
 "../../../modules/core-crm/sql/003_crm_employees_channels.sql",
 "../../../modules/inbox/sql/001_inbox_foundation.sql",
 "../../../modules/whatsapp/sql/001_whatsapp_accounts.sql",
 "../../../modules/whatsapp/sql/002_whatsapp_inbound.sql",
 "../../../modules/whatsapp/sql/003_whatsapp_outbound_inbox.sql",
 "../../../modules/whatsapp/sql/004_whatsapp_conversation_phone.sql",
 "../../../modules/whatsapp/sql/005_whatsapp_history.sql",
 "../../../modules/organizations/sql/003_legacy_ownership.sql",
 "../../../modules/organizations/sql/004_whatsapp_route_owner_guard.sql",
 "../../../modules/organizations/sql/005_scoped_relationship_integrity.sql",
 "../sql/001_platform_events.sql",
 "../sql/002_event_type_version_consistency.sql",
];
const count=async(pool,table)=>Number((await pool.query(
 "SELECT count(*)::int AS n FROM "+table)).rows[0].n);

test("PG17 disposable: durable single-owner boundary between legacy and events projections",
 {skip:!safe},async t=>{
 const admin=new pg.Client({connectionString:url});await admin.connect();
 const version=(await admin.query("SELECT current_setting('server_version_num')::int AS n")).rows[0].n;
 assert.ok(version>=170000&&version<180000);
 const tenantId=randomUUID(),orgId=randomUUID(),workspaceId=randomUUID(),
  accountId=randomUUID(),database=expectedTenantDatabase(tenantId).database_name;
 let pool,provider,created=false;
 try{
  await admin.query('CREATE DATABASE "'+database+'"');created=true;
  pool=new pg.Pool({connectionString:dsn(database),max:6});
  for(const migration of migrations)await pool.query(await source(migration));
  await pool.query(
   "INSERT INTO platform_organizations(tenant_id,id,display_name,is_default) VALUES($1,$2,'One org',true)",
   [tenantId,orgId]);
  await pool.query(
   "INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug,is_default) VALUES($1,$2,$3,'Default','default',true)",
   [tenantId,workspaceId,orgId]);
  await pool.query(
   "INSERT INTO whatsapp_accounts(tenant_id,id,display_name,platform_organization_id,service_enabled) VALUES($1,$2,'WA test',$3,true)",
   [tenantId,accountId,orgId]);
  provider=new TenantPgProvider({db:{query:async(_sql,values)=>({
   rows:[expectedTenantDatabase(values[0])],rowCount:1,
  })}});
  provider.pools.set(tenantId,{pool,last:Date.now()});
  const legacyStore=new WhatsAppInboundStore(provider);
  const legacyProjection=new WhatsAppInboxProjection(provider);
  const bridge=new WhatsAppTransactionalInboundBridge(provider,new TenantEventPublisher());
  const stage=composeTenantEventWorker({
   databases:provider,
   modules:{canExecuteModule:async()=>true},
   serviceGrants:{canProcess:async()=>true},
   principalId:"syndes-cutover-fixture",
  });
  const phone="+5511987654321",jid="5511987654321@s.whatsapp.net";
  const message=externalMessageId=>({
   version:"1",type:"whatsapp.message.received",tenantId,accountId,
   message:{accountId,externalMessageId,senderExternalId:jid,chatExternalId:jid,
    senderPhone:phone,body:"Single owner fixture",source:"live",isGroup:false,
    fromMe:false,occurredAt:"2026-11-11T12:00:00.000Z"},
  });

  await t.test("old schema remains compatible with legacy; new producer fails closed",async()=>{
   const old=message(randomUUID());
   assert.deepEqual(await legacyStore.persist(tenantId,old),{accepted:true,duplicate:false});
   await assert.rejects(bridge.persist(tenantId,message(randomUUID())),
    error=>error.code==="42703");
   assert.equal(await count(pool,"platform_events.outbox_events"),0);
   assert.equal(await legacyProjection.deliverNext(tenantId),"delivered");
   assert.equal(await count(pool,"inbox_messages"),1);
  });

  await t.test("migration 008 backfills immutable legacy ownership, replay safe",async()=>{
   const ddl=await source("../../../modules/whatsapp/sql/008_whatsapp_projection_owner.sql");
   await pool.query(ddl);await pool.query(ddl);
   const rows=(await pool.query(
    "SELECT DISTINCT projection_path FROM whatsapp_inbound_events"
   )).rows;
   assert.deepEqual(rows,[{projection_path:"legacy"}]);
   assert.equal((await pool.query(`
    SELECT count(*)::int AS n FROM pg_trigger
    WHERE tgrelid='whatsapp_inbound_events'::regclass
      AND tgname='whatsapp_inbound_projection_path_immutable' AND NOT tgisinternal
   `)).rows[0].n,1);
   await assert.rejects(pool.query(`
    INSERT INTO whatsapp_inbound_events
     (tenant_id,account_id,external_message_id,event_type,payload,projection_path)
    VALUES($1,$2,$3,'whatsapp.contact.name','{}'::jsonb,'events')
   `,[tenantId,accountId,randomUUID()]),error=>error.code==="23514");
  });

  await t.test("legacy-first duplicate never creates a second events-path projection",async()=>{
   const m=message(randomUUID());
   await legacyStore.persist(tenantId,m);
   assert.deepEqual(await bridge.persist(tenantId,m),{accepted:true,duplicate:true});
   assert.equal(await count(pool,"platform_events.outbox_events"),0);
   assert.equal(await legacyProjection.deliverNext(tenantId),"delivered");
   assert.equal(await count(pool,"inbox_messages"),2);
   const id=(await pool.query(
    "SELECT id::text FROM whatsapp_inbound_events WHERE external_message_id=$1",
    [m.message.externalMessageId])).rows[0].id;
   await assert.rejects(pool.query(
    "UPDATE whatsapp_inbound_events SET projection_path='events' WHERE id=$1",
    [id]),error=>error.code==="23514");
  });

  await t.test("events-first duplicate is invisible to legacy and processed once by the new Inbox",async()=>{
   const m=message(randomUUID());
   assert.deepEqual(await stage.bridge.persist(tenantId,m),{accepted:true,duplicate:false});
   assert.deepEqual(await legacyStore.persist(tenantId,m),{accepted:true,duplicate:true});
   const row=(await pool.query(
    "SELECT projection_path,processed_at FROM whatsapp_inbound_events WHERE external_message_id=$1",
    [m.message.externalMessageId])).rows[0];
   assert.equal(row.projection_path,"events");
   assert.equal(row.processed_at,null);
   assert.equal(await legacyProjection.deliverNext(tenantId),"empty");
   assert.equal(await count(pool,"inbox_messages"),2);
   assert.equal(await stage.dispatcher.routePending(tenantId),1);
   assert.equal(await stage.dispatcher.processNext(tenantId),"delivered");
   assert.equal(await count(pool,"inbox_messages"),3);
   assert.equal(await legacyProjection.deliverNext(tenantId),"empty");
   assert.deepEqual(await stage.bridge.persist(tenantId,m),{accepted:true,duplicate:true});
   assert.equal(await count(pool,"inbox_messages"),3);
   assert.equal((await pool.query(
    "SELECT processed_at IS NOT NULL AS processed FROM whatsapp_inbound_events WHERE external_message_id=$1",
    [m.message.externalMessageId])).rows[0].processed,true);
   await assert.rejects(pool.query(
    "UPDATE whatsapp_inbound_events SET projection_path='legacy' WHERE external_message_id=$1",
    [m.message.externalMessageId]),error=>error.code==="23514");
  });

  await t.test("metadata and historical envelopes still default to legacy",async()=>{
   // This is not a valid provider payload and is tested only as a DB ownership marker.
   await pool.query(`
    INSERT INTO whatsapp_inbound_events
     (tenant_id,account_id,external_message_id,event_type,payload)
    VALUES($1,$2,$3,'whatsapp.chat.snapshot','{}'::jsonb)
   `,[tenantId,accountId,"chat:"+randomUUID()]);
   assert.equal((await pool.query(`
    SELECT projection_path FROM whatsapp_inbound_events
    WHERE event_type='whatsapp.chat.snapshot'
   `)).rows[0].projection_path,"legacy");
  });
  await provider.onModuleDestroy();provider=null;
 }finally{
  if(provider)await provider.onModuleDestroy().catch(()=>{});
  else if(pool)await pool.end().catch(()=>{});
  if(created)await admin.query('DROP DATABASE "'+database+'" WITH (FORCE)');
  await admin.end();
 }
});
