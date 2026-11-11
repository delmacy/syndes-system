import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import pg from "pg";
import {TenantPgProvider,expectedTenantDatabase} from "../dist/tenant-database.js";
import {TenantEventPublisher} from "../dist/platform-event-publisher.js";
import {TenantEventDispatcher} from "../dist/platform-event-dispatcher.js";
import {WhatsAppInboundStore} from "../../../modules/whatsapp/dist/inbound-http.js";
import {WhatsAppTransactionalInboundBridge,PostgresWhatsAppInboundMessageReader}
 from "../../../modules/whatsapp/dist/event-bridge.js";
import {PgWhatsAppConversationRouteCommands}
 from "../../../modules/whatsapp/dist/event-route-commands.js";
import {PgWhatsAppConversationIdentityReader}
 from "../../../modules/whatsapp/dist/event-identity-reader.js";
import {InboxWhatsAppReceivedConsumer}
 from "../../../modules/inbox/dist/whatsapp-event-consumer.js";
import {InboxCrmPersonResolvedConsumer}
 from "../../../modules/inbox/dist/crm-link-event-consumer.js";
import {CrmWhatsAppIdentityPolicy,CrmWhatsAppIdentityConsumer}
 from "../../../modules/core-crm/dist/whatsapp-identity-events.js";

const url=process.env.SYNDES_EVENTS_PG_URL;
const safe=(()=>{
 if(!url||process.env.SYNDES_EVENTS_DISPOSABLE!=="EVENTS_TEST_ONLY")return false;
 try{
  const u=new URL(url);
  return u.protocol==="postgresql:"&&["127.0.0.1","localhost"].includes(u.hostname)&&
    u.pathname==="/postgres"&&u.username==="postgres"&&u.password.startsWith("ci-only-disposable-");
 }catch{return false}
})();
const sql=(path)=>readFile(new URL(path,import.meta.url),"utf8");
const dbUrl=(name)=>{const u=new URL(url);u.pathname="/"+name;return u.toString()};
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
];
const count=async(pool,table)=>Number((await pool.query("SELECT count(*)::int AS n FROM "+table)).rows[0].n);
const message=(tenantId,accountId,externalMessageId,externalId,phone,body="Mensagem de teste COMMIT ROLLBACK")=>({
 version:"1",type:"whatsapp.message.received",tenantId,accountId,
 message:{accountId,externalMessageId,senderExternalId:externalId,
  chatExternalId:externalId,senderPhone:phone,
  body,occurredAt:"2026-11-11T10:00:00.000Z",source:"live",isGroup:false,fromMe:false},
});

test("PG17 disposable: real WhatsApp -> Inbox -> CRM -> Inbox with conservative identity",
 {skip:!safe},async t=>{
 const admin=new pg.Client({connectionString:url});await admin.connect();
 const ver=await admin.query("SELECT current_setting('server_version_num')::int AS n");
 assert.ok(ver.rows[0].n>=170000&&ver.rows[0].n<180000);
 const tenantId=randomUUID(),orgId=randomUUID(),workspaceId=randomUUID(),
  accountId=randomUUID(),personId=randomUUID(),
  databaseName=expectedTenantDatabase(tenantId).database_name;
 let created=false,pool;
 try{
  await admin.query('CREATE DATABASE "'+databaseName+'"');created=true;
  pool=new pg.Pool({connectionString:dbUrl(databaseName),max:8});
  for(const migration of migrations){
   try{await pool.query(await sql(migration))}
   catch(error){throw new Error("Migration failed: "+migration+" — "+error.message,{cause:error})}
  }
  await pool.query(
   "INSERT INTO platform_organizations(tenant_id,id,display_name,is_default) VALUES($1,$2,'Test organization',true)",
   [tenantId,orgId]);
  await pool.query(
   "INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug,is_default) VALUES($1,$2,$3,'Main','main',true)",
   [tenantId,workspaceId,orgId]);
  await pool.query(
   "INSERT INTO whatsapp_accounts(tenant_id,id,display_name,platform_organization_id,service_enabled) VALUES($1,$2,'Test WhatsApp',$3,true)",
   [tenantId,accountId,orgId]);
  const trustedPhone="+5511999888777",trustedJid="5511999888777@s.whatsapp.net";
  await pool.query(
   "INSERT INTO crm_people(tenant_id,id,name,phone,platform_organization_id) VALUES($1,$2,'Person from CRM',$3,$4)",
   [tenantId,personId,trustedPhone,orgId]);
  await pool.query(
   "INSERT INTO crm_channel_identities(tenant_id,id,person_id,channel,external_id,platform_organization_id) VALUES($1,$2,$3,'whatsapp',$4,$5)",
   [tenantId,randomUUID(),personId,trustedJid,orgId]);

  const provider=new TenantPgProvider({db:{
   query:async(_query,params)=>({rows:[expectedTenantDatabase(params[0])],rowCount:1})
  }});
  provider.pools.set(tenantId,{pool,last:Date.now()});
  const publisher=new TenantEventPublisher();
  const bridge=new WhatsAppTransactionalInboundBridge(provider,publisher);
  const store=new WhatsAppInboundStore(provider,bridge);
  const inbox=new InboxWhatsAppReceivedConsumer(
   new PostgresWhatsAppInboundMessageReader(),new PgWhatsAppConversationRouteCommands(),publisher);
  const crmPolicy=new CrmWhatsAppIdentityPolicy(new PgWhatsAppConversationIdentityReader());
  const crm=new CrmWhatsAppIdentityConsumer(crmPolicy,publisher);
  const link=new InboxCrmPersonResolvedConsumer(crmPolicy);
  const subscribers=[
   {id:"inbox.message-received-v2",moduleId:"inbox",types:["whatsapp.message.received.v2"],
    handle:(tx,evt)=>inbox.handle(tx,evt)},
   {id:"crm.resolve-person",moduleId:"crm",types:["inbox.participant.observed.v1"],
    handle:(tx,evt)=>crm.handle(tx,evt)},
   {id:"inbox.crm-person-link",moduleId:"inbox",types:["crm.person.resolved.v1"],
    handle:(tx,evt)=>link.handle(tx,evt)},
  ];
  let crmEnabled=true;
  const guard={authorize:async q=>q.moduleId==="crm"&&!crmEnabled?"suspended":"enabled"};
  const worker=new TenantEventDispatcher(provider,subscribers,guard,"syndes-worker-integration-fixture");

  await t.test("failure to publish rolls back the original WhatsApp inbound row",async()=>{
   const faulty=new WhatsAppTransactionalInboundBridge(provider,{
    publish:async()=>{throw Error("forced outbox unavailable")}
   });
   await assert.rejects(faulty.persist(tenantId,
    message(tenantId,accountId,randomUUID(),trustedJid,trustedPhone)),/forced outbox unavailable/);
   assert.equal(await count(pool,"whatsapp_inbound_events"),0);
   assert.equal(await count(pool,"platform_events.outbox_events"),0);
  });

  await t.test("persist WA text atomically without CRM, then link existing person",async()=>{
   const received=message(tenantId,accountId,randomUUID(),trustedJid,trustedPhone);
   const accepted=await store.persist(tenantId,received);
   assert.deepEqual(accepted,{accepted:true,duplicate:false});
   assert.equal(await count(pool,"whatsapp_inbound_events"),1);
   assert.equal(await count(pool,"platform_events.outbox_events"),1);
   const raw=(await pool.query("SELECT payload::text AS text FROM platform_events.outbox_events")).rows[0].text;
   assert.ok(!raw.includes("Mensagem")&&!raw.includes(trustedPhone)&&!raw.includes(trustedJid));
   assert.match(raw,/"inboundEventId": "[0-9]+"|"inboundEventId":"[0-9]+"/);

   assert.equal(await worker.routePending(tenantId),1);
   assert.equal(await worker.processNext(tenantId),"delivered");
   assert.equal(await count(pool,"inbox_conversations"),1);
   assert.equal(await count(pool,"inbox_messages"),1);
   assert.equal((await pool.query("SELECT crm_person_id FROM inbox_conversations")).rows[0].crm_person_id,null);
   assert.equal((await pool.query("SELECT processed_at IS NOT NULL AS processed FROM whatsapp_inbound_events")).rows[0].processed,true);

   crmEnabled=false;
   assert.equal(await worker.routePending(tenantId),1);
   assert.equal(await worker.processNext(tenantId),"suspended");
   assert.equal(await count(pool,"inbox_messages"),1);
   assert.equal(await count(pool,"crm_people"),1);
   crmEnabled=true;
   await pool.query("UPDATE platform_events.event_deliveries SET next_attempt_at=clock_timestamp() WHERE state='suspended'");
   assert.equal(await worker.processNext(tenantId),"delivered");
   assert.equal(await worker.routePending(tenantId),1);
   assert.equal(await worker.processNext(tenantId),"delivered");

   const c=(await pool.query("SELECT id::text,crm_person_id::text,unread_count FROM inbox_conversations")).rows[0];
   assert.equal(c.crm_person_id,personId);
   assert.equal(Number(c.unread_count),1);
   assert.equal(await count(pool,"whatsapp_conversation_routes"),1);
   assert.equal(await count(pool,"crm_people"),1);
   assert.equal(await count(pool,"platform_events.consumer_inbox"),3);
   const republished=await store.persist(tenantId,received);
   assert.deepEqual(republished,{accepted:true,duplicate:true});
   assert.equal(await count(pool,"inbox_messages"),1);
   assert.equal(await count(pool,"platform_events.outbox_events"),3);
  });

  await t.test("group text stays in Inbox without CRM identity or bot activation",async()=>{
   const base=message(tenantId,accountId,randomUUID(),trustedJid,trustedPhone,"Mensagem em grupo");
   const group={...base,message:{...base.message,
    chatExternalId:"1234567890@g.us",isGroup:true,
    chatName:"Equipe",senderPhone:undefined}};
   const before=await count(pool,"platform_events.outbox_events");
   await store.persist(tenantId,group);
   assert.equal(await worker.routePending(tenantId),1);
   assert.equal(await worker.processNext(tenantId),"delivered");
   assert.equal(await count(pool,"platform_events.outbox_events"),before+1);
   const row=(await pool.query(
    "SELECT c.is_group,c.crm_person_id,c.unread_count,m.bot_eligible FROM inbox_conversations c JOIN inbox_messages m ON m.tenant_id=c.tenant_id AND m.conversation_id=c.id WHERE c.is_group=true"
   )).rows[0];
   assert.equal(row.is_group,true);
   assert.equal(row.crm_person_id,null);
   assert.equal(row.unread_count,0);
   assert.equal(row.bot_eligible,false);
  });

  await t.test("failure after Inbox writes rolls back message, route and consumer acknowledgement",async()=>{
   const base=message(tenantId,accountId,randomUUID(),trustedJid,trustedPhone,"Failure rollback test");
   const group={...base,message:{...base.message,
    chatExternalId:"9876543210@g.us",isGroup:true,
    chatName:"Erro de teste",senderPhone:undefined}};
   const beforeMessages=await count(pool,"inbox_messages");
   const beforeConversations=await count(pool,"inbox_conversations");
   const beforeRoutes=await count(pool,"whatsapp_conversation_routes");
   await store.persist(tenantId,group);
   assert.equal(await worker.routePending(tenantId),1);
   const ownerCommands=new PgWhatsAppConversationRouteCommands();
   const faultyInbox=new InboxWhatsAppReceivedConsumer(
    new PostgresWhatsAppInboundMessageReader(),{
     canonicalChat:(tx,scope)=>ownerCommands.canonicalChat(tx,scope),
     attachAndAcknowledge:async()=>{throw Error("transient WhatsApp command failure")},
    },publisher);
   const failingWorker=new TenantEventDispatcher(provider,
    subscribers.map(item=>item.id==="inbox.message-received-v2"?
     {...item,handle:(tx,evt)=>faultyInbox.handle(tx,evt)}:item),
    guard,"syndes-worker-rollback-fixture");
   assert.equal(await failingWorker.processNext(tenantId),"retry");
   assert.equal(await count(pool,"inbox_messages"),beforeMessages);
   assert.equal(await count(pool,"inbox_conversations"),beforeConversations);
   assert.equal(await count(pool,"whatsapp_conversation_routes"),beforeRoutes);
   const state=(await pool.query(
    "SELECT processed_at FROM whatsapp_inbound_events WHERE tenant_id=$1 AND external_message_id=$2",
    [tenantId,group.message.externalMessageId])).rows[0];
   assert.equal(state.processed_at,null);
   await pool.query(
    "UPDATE platform_events.event_deliveries SET next_attempt_at=clock_timestamp() WHERE state='retry'");
   assert.equal(await worker.processNext(tenantId),"delivered");
   assert.equal(await count(pool,"inbox_messages"),beforeMessages+1);
   assert.equal(await count(pool,"inbox_conversations"),beforeConversations+1);
   assert.equal(await count(pool,"whatsapp_conversation_routes"),beforeRoutes+1);
  });

  await t.test("unknown contact yields review event, never auto-creates CRM person",async()=>{
   const before=await count(pool,"crm_people");
   const payload=message(tenantId,accountId,randomUUID(),
    "5511966600000@s.whatsapp.net","+5511966600000","Unrecognized customer");
   await store.persist(tenantId,payload);
   assert.equal(await worker.routePending(tenantId),1);
   assert.equal(await worker.processNext(tenantId),"delivered");
   assert.equal(await worker.routePending(tenantId),1);
   assert.equal(await worker.processNext(tenantId),"delivered");
   const rows=await pool.query(`
    SELECT payload FROM platform_events.outbox_events
    WHERE event_type='crm.person.review_required.v1'
   `);
   assert.equal(rows.rows.length,1);
   assert.equal(rows.rows[0].payload.reason,"missing_identity");
   assert.equal(await count(pool,"crm_people"),before);
   assert.equal((await pool.query("SELECT count(*)::int AS n FROM inbox_conversations WHERE crm_person_id IS NULL AND is_group=false")).rows[0].n,1);
   // Unknown review event is retained as unsupported for manual action.
   assert.equal(await worker.routePending(tenantId),1);
  });

  await t.test("conflicting exact evidence requires review without changing an existing link",async()=>{
   const conflictingPerson=randomUUID();
   await pool.query(
    "INSERT INTO crm_people(tenant_id,id,name,phone,platform_organization_id) VALUES($1,$2,'Conflicting phone',$3,$4)",
    [tenantId,conflictingPerson,trustedPhone,orgId]);
   const payload=message(tenantId,accountId,randomUUID(),trustedJid,trustedPhone,"New message");
   await store.persist(tenantId,payload);
   assert.equal(await worker.routePending(tenantId),1);
   assert.equal(await worker.processNext(tenantId),"delivered");
   assert.equal(await worker.routePending(tenantId),1);
   assert.equal(await worker.processNext(tenantId),"delivered");
   const reasons=(await pool.query(
    "SELECT payload->>'reason' AS reason FROM platform_events.outbox_events WHERE event_type='crm.person.review_required.v1'"
   )).rows.map(x=>x.reason);
   assert.ok(reasons.includes("ambiguous"));
   const linked=(await pool.query("SELECT crm_person_id::text FROM inbox_conversations WHERE external_thread_id IS NOT NULL AND crm_person_id IS NOT NULL")).rows[0];
   assert.equal(linked.crm_person_id,personId);
  });

  await t.test("loss of CRM identity before final link never links a stale person",async()=>{
   const transientPhone="+5511977700000",transientJid="5511977700000@s.whatsapp.net";
   const provisionalExistingId=randomUUID();
   await pool.query(
    "INSERT INTO crm_people(tenant_id,id,name,phone,platform_organization_id) VALUES($1,$2,'Existing but archived later',$3,$4)",
    [tenantId,provisionalExistingId,transientPhone,orgId]);
   await pool.query(
    "INSERT INTO crm_channel_identities(tenant_id,id,person_id,channel,external_id,platform_organization_id) VALUES($1,$2,$3,'whatsapp',$4,$5)",
    [tenantId,randomUUID(),provisionalExistingId,transientJid,orgId]);
   await store.persist(tenantId,message(tenantId,accountId,randomUUID(),transientJid,transientPhone));
   await worker.routePending(tenantId);await worker.processNext(tenantId);
   await worker.routePending(tenantId);await worker.processNext(tenantId);
   assert.equal(await worker.routePending(tenantId),1);
   await pool.query("UPDATE crm_people SET archived_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2",
    [tenantId,provisionalExistingId]);
   assert.equal(await worker.processNext(tenantId),"retry");
   const stillUnlinked=await pool.query(
    "SELECT c.crm_person_id FROM inbox_conversations c JOIN whatsapp_conversation_routes r ON r.tenant_id=c.tenant_id AND r.conversation_id=c.id WHERE r.recipient_external_id=$1",
    [transientJid]);
   assert.equal(stillUnlinked.rows[0].crm_person_id,null);
  });

  await provider.onModuleDestroy();
 }finally{
  if(pool)await pool.end().catch(()=>{});
  if(created){
   await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1",[databaseName]);
   await admin.query('DROP DATABASE "'+databaseName+'"');
  }
  await admin.end();
 }
});
