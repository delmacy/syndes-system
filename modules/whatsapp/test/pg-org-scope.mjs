import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {WhatsAppAccounts} from "../dist/accounts.js";
import {WhatsAppInboxProjection} from "../dist/dispatch.js";
import {WhatsAppInboundStore} from "../dist/inbound-http.js";
import {WhatsAppReplyQueue} from "../dist/outbound-reply.js";
import {WhatsAppOutboundRelay} from "../dist/outbound-relay.js";

const require=createRequire(new URL("../../../apps/core-host/package.json",import.meta.url));
const {Client}=require("pg");
const url=process.env.SYNDES_INBOX_SCOPE_TEST_PG_URL;
const file=rel=>readFile(new URL(rel,import.meta.url),"utf8");
const strip=s=>s.replace(/^\s*(?:BEGIN|COMMIT);\s*$/gim,"");
const T="11111111-1111-4111-8111-111111111111";
test("Whatsmeow account/projection/reply/worker isolate two organizations within one tenant",{
 skip:!url&&"requires disposable PostgreSQL"
},async()=>{
 const c=new Client({connectionString:url});
 await c.connect();
 const schema="wa_scope_"+randomUUID().replaceAll("-","").slice(0,14);
 const oa=randomUUID(),ob=randomUUID(),wa=randomUUID(),wb=randomUUID();
 const accountA=randomUUID(),accountB=randomUUID();
 const alice={tenantId:T,organizationId:oa,workspaceId:wa,actor:{id:"alice"}};
 const bob={tenantId:T,organizationId:ob,workspaceId:wb,actor:{id:"bob"}};
 try{
  await c.query("BEGIN");
  await c.query("CREATE SCHEMA "+schema);
  await c.query("SET LOCAL search_path TO "+schema);
  for(const migration of [
   "../../core-crm/sql/001_crm_foundation.sql",
   "../../core-crm/sql/002_crm_tags_notes.sql",
   "../../core-crm/sql/003_crm_employees_channels.sql",
   "../../inbox/sql/001_inbox_foundation.sql",
   "../sql/001_whatsapp_accounts.sql",
   "../sql/002_whatsapp_inbound.sql",
   "../sql/003_whatsapp_outbound_inbox.sql",
   "../sql/004_whatsapp_conversation_phone.sql",
   "../sql/005_whatsapp_history.sql",
   "../sql/006_whatsapp_contact_names.sql",
   "../sql/007_whatsapp_delivery_receipts.sql",
   "../../organizations/sql/001_account_hierarchy.sql",
   "../../organizations/sql/002_legacy_single_context_gate.sql",
   "../../organizations/sql/003_legacy_ownership.sql",
   "../../organizations/sql/004_whatsapp_route_owner_guard.sql",
   "../../organizations/sql/005_scoped_relationship_integrity.sql"
  ]) await c.query(strip(await file(migration)));
  // Replaying the additive 004 migration must be safe for an operator.
  await c.query(await file("../../organizations/sql/004_whatsapp_route_owner_guard.sql"));
  // The physical single-context barrier is lifted ONLY in this rolled-back
  // PostgreSQL fixture to exercise the SQL boundaries the future product needs.
  await c.query("DROP INDEX platform_legacy_single_organization");
  await c.query("DROP INDEX platform_legacy_single_workspace");
  await c.query("INSERT INTO platform_organizations(tenant_id,id,display_name,is_default) VALUES($1,$2,'Alpha',true),($1,$3,'Beta',false)",[T,oa,ob]);
  await c.query("INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug,is_default) VALUES($1,$2,$3,'Alpha','alpha',true),($1,$4,$5,'Beta','beta',true)",[T,wa,oa,wb,ob]);
  await c.query("INSERT INTO whatsapp_accounts(id,tenant_id,display_name,platform_organization_id) VALUES($1,$2,'Alpha WA',$3),($4,$2,'Beta WA',$5)",[accountA,T,oa,accountB,ob]);
  const db={tenantId:T,query:async(sql,args=[])=>{
   const result=await c.query(sql,[...args]);
   return {rows:result.rows,rowCount:result.rowCount};
  }};
  const accounts=new WhatsAppAccounts(async()=>db);
  const aa=await accounts.list(alice);
  const ab=await accounts.list(bob);
  assert.deepEqual(aa.map(a=>a.id),[accountA]);
  assert.deepEqual(ab.map(a=>a.id),[accountB]);
  assert.equal(await accounts.get(alice,accountB),null);
  assert.equal(await accounts.get(bob,accountA),null);
  assert.equal(await accounts.setEnabled(alice,accountB,false),null);
  assert.equal((await accounts.create(alice,"Fresh A")).tenantId,T);
  const fresh=await c.query("SELECT platform_organization_id FROM whatsapp_accounts WHERE display_name='Fresh A'");
  assert.equal(fresh.rows[0].platform_organization_id,oa);
  const gatewayInput=(accountId,chat,mid,body)=>({
   version:"1",type:"whatsapp.message.received",tenantId:T,accountId,
   message:{accountId,externalMessageId:mid,senderExternalId:chat,
    body,occurredAt:"2026-11-09T14:00:00.000Z"}
  });
  const store=new WhatsAppInboundStore({resolve:async()=>db});
  assert.equal((await store.persist(T,gatewayInput(accountA,"5511999991111@s.whatsapp.net","A-1","Alpha secret"))).accepted,true);
  assert.equal((await store.persist(T,gatewayInput(accountB,"5511999992222@s.whatsapp.net","B-1","Beta secret"))).accepted,true);
  const notifications=[];
  const projection=new WhatsAppInboxProjection({resolve:async()=>db},
   scope=>notifications.push(scope));
  assert.equal(await projection.deliverNext(T),"delivered");
  assert.equal(await projection.deliverNext(T),"delivered");
  assert.equal(await projection.deliverNext(T),"empty");
  assert.deepEqual(notifications,[
   {tenantId:T,organizationId:oa,workspaceId:wa},
   {tenantId:T,organizationId:ob,workspaceId:wb}
  ],"Each received Whatsmeow message invalidates only its authorized workspace");
  const ownership=await c.query(`
   SELECT c.id,c.platform_organization_id AS org,
     c.platform_origin_workspace_id AS origin_ws,
     c.platform_current_workspace_id AS current_ws,r.account_id,
     m.body
   FROM inbox_conversations c
   JOIN whatsapp_conversation_routes r ON r.tenant_id=c.tenant_id AND r.conversation_id=c.id
   JOIN inbox_messages m ON m.tenant_id=c.tenant_id AND m.conversation_id=c.id
   ORDER BY m.body`);
  assert.equal(ownership.rows.length,2);
  assert.equal(ownership.rows[0].body,"Alpha secret");
  assert.equal(ownership.rows[0].org,oa);
  assert.equal(ownership.rows[0].origin_ws,wa);
  assert.equal(ownership.rows[0].current_ws,wa);
  assert.equal(ownership.rows[0].account_id,accountA);
  assert.equal(ownership.rows[1].body,"Beta secret");
  assert.equal(ownership.rows[1].org,ob);
  assert.equal(ownership.rows[1].origin_ws,wb);
  assert.equal(ownership.rows[1].account_id,accountB);
  const ca=ownership.rows[0].id,cb=ownership.rows[1].id;
  // A direct SQL caller cannot bypass the application: a bad route must
  // be rejected by migration 004's trigger, even inside one trusted tenant.
  await c.query("SAVEPOINT denied_route_insert");
  await assert.rejects(
   c.query("INSERT INTO whatsapp_conversation_routes(tenant_id,conversation_id,account_id,recipient_external_id) VALUES($1,$2,$3,'foreign@device')",[T,ca,accountB]),
   error=>error.code==="23514");
  await c.query("ROLLBACK TO SAVEPOINT denied_route_insert");
  const originalRoute=await c.query("SELECT account_id FROM whatsapp_conversation_routes WHERE tenant_id=$1 AND conversation_id=$2",[T,ca]);
  assert.equal(originalRoute.rows[0].account_id,accountA);
  await c.query("SAVEPOINT denied_route_update");
  await assert.rejects(
   c.query("UPDATE whatsapp_conversation_routes SET account_id=$3 WHERE tenant_id=$1 AND conversation_id=$2",[T,ca,accountB]),
   error=>error.code==="23514");
  await c.query("ROLLBACK TO SAVEPOINT denied_route_update");
  const replies=new WhatsAppReplyQueue({resolve:async()=>db});
  const betaDecorated=await replies.decorateConversations(alice,[{id:cb,channel:"whatsapp"}]);
  assert.equal(betaDecorated[0].phoneNumber,null);
  await assert.rejects(replies.enqueue(alice,cb,"Try other company"),/route unavailable/);
  await assert.rejects(replies.enqueue(bob,ca,"Try Alpha"),/route unavailable/);
  await c.query("UPDATE inbox_conversations SET assigned_to='alice',handoff='human' WHERE id=$1",[ca]);
  const reply=await replies.enqueue(alice,ca,"Alpha outbound");
  assert.equal(reply?.body,"Alpha outbound");
  const outbound=await c.query("SELECT account_id,inbox_message_id,status FROM whatsapp_outbox WHERE inbox_message_id=$1",[reply.id]);
  assert.equal(outbound.rows[0].account_id,accountA);
  const malicious=randomUUID(),unmappedMessage=randomUUID();
  // The outbox enforces a unique inbox_message_id, so create a distinct
  // local message to test malicious cross-owner enqueue without violating
  // an unrelated uniqueness constraint.
  await c.query("INSERT INTO inbox_messages(tenant_id,id,conversation_id,direction,body,author_id) VALUES($1,$2,$3,'outbound','Unauthorized intent','attacker')",[T,unmappedMessage,ca]);
  // Migration 005 prevents the corrupt outbox row at INSERT time.
  await c.query("SAVEPOINT bad_outbox");
  await assert.rejects(c.query(`INSERT INTO whatsapp_outbox
   (id,tenant_id,account_id,idempotency_key,recipient_external_id,body,inbox_message_id)
   VALUES ($1,$2,$3,'malicious-b','5511999992222@s.whatsapp.net','Wrong org',$4)`,
   [malicious,T,accountB,unmappedMessage]),error=>error.code==="23514");
  await c.query("ROLLBACK TO SAVEPOINT bad_outbox");
  // ONLY disposable schema: simulate a previously corrupted outbox row
  // to prove the worker's independent owner check still prevents delivery.
  await c.query("ALTER TABLE whatsapp_outbox DISABLE TRIGGER whatsapp_outbox_platform_guard");
  await c.query(`INSERT INTO whatsapp_outbox
   (id,tenant_id,account_id,idempotency_key,recipient_external_id,body,inbox_message_id)
   VALUES ($1,$2,$3,'malicious-b','5511999992222@s.whatsapp.net','Wrong org',$4)`,
   [malicious,T,accountB,unmappedMessage]);
  await c.query("ALTER TABLE whatsapp_outbox ENABLE TRIGGER whatsapp_outbox_platform_guard");
  const sent=[];
  const relay=new WhatsAppOutboundRelay({resolve:async()=>db},{
   sendQueued:async(tenantId,accountId,input)=>{sent.push({tenantId,accountId,input});return {queueId:123}},
   outboundStatus:async()=>{throw Error("Unexpected poll")}
  });
  assert.equal(await relay.deliverNext(T),"queued");
  assert.equal(sent.length,1);
  assert.equal(sent[0].accountId,accountA);
  // The legitimate A intent is no longer ready. The malicious B intent is
  // filtered at SQL before any provider send, despite a valid tenant/account.
  assert.equal(await relay.deliverNext(T),"empty");
  assert.equal(sent.length,1,"No cross-organization WhatsApp delivery");
  const counts=await c.query("SELECT count(*)::int n FROM inbox_messages WHERE tenant_id=$1 AND conversation_id=$2",[T,cb]);
  assert.equal(counts.rows[0].n,1,"Foreign organization message untouched");
 }finally{
  await c.query("ROLLBACK");
  await c.end();
 }
});
