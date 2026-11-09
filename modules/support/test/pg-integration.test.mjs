import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import pg from "pg";
import {SupportService} from "../dist/service.js";
import {AccessDeniedError} from "@syndes/core-kernel";

const url=process.env.SYNDES_SUPPORT_TEST_PG_URL;
const T="11111111-1111-4111-8111-111111111111";
const FOREIGN="22222222-2222-4222-8222-222222222222";
const actor=id=>({tenantId:T,actor:{id,kind:"user"}});
const source=rel=>readFile(new URL(rel,import.meta.url),"utf8");
const strip=sql=>sql.replace(/^\s*(?:BEGIN|COMMIT);\s*$/gim,"");
const migrations=[
 "../../core-crm/sql/001_crm_foundation.sql",
 "../../core-crm/sql/002_crm_tags_notes.sql",
 "../../core-crm/sql/003_crm_employees_channels.sql",
 "../../inbox/sql/001_inbox_foundation.sql",
 "../../whatsapp/sql/001_whatsapp_accounts.sql",
 "../../whatsapp/sql/002_whatsapp_inbound.sql",
 "../../whatsapp/sql/003_whatsapp_outbound_inbox.sql",
 "../../whatsapp/sql/004_whatsapp_conversation_phone.sql",
 "../../whatsapp/sql/005_whatsapp_history.sql",
 "../../whatsapp/sql/006_whatsapp_contact_names.sql",
 "../../whatsapp/sql/007_whatsapp_delivery_receipts.sql",
 "../../organizations/sql/001_account_hierarchy.sql",
 "../../organizations/sql/002_legacy_single_context_gate.sql",
 "../../organizations/sql/003_legacy_ownership.sql",
 "../../organizations/sql/004_whatsapp_route_owner_guard.sql",
 "../../organizations/sql/005_scoped_relationship_integrity.sql",
 "../../organizations/sql/006_context_creation_audit.sql",
 "../sql/001_support_cases.sql"
];
test("real PostgreSQL: migration replay, case flow, queue/tenant isolation, WhatsApp ownership and audit",{skip:!url&&"requires disposable PostgreSQL"},async()=>{
 const client=new pg.Client({connectionString:url});
 await client.connect();
 const schema="support_"+randomUUID().replaceAll("-","").slice(0,16);
 const org=randomUUID(),ws=randomUUID(),p=randomUUID(),conversation=randomUUID();
 const account=randomUUID(),foreignAccount=randomUUID(),foreignConversation=randomUUID();
 const caseTenant=FOREIGN;
 const db={tenantId:T,query:async(statement,args)=>{
  const res=await client.query(statement,[...args]);return {rows:res.rows,rowCount:res.rowCount};
 }};
 const grants=[];
 const kernel={execute:async(req,handler)=>{
  grants.push(req);
  if(req.actor.id==="platform-admin")throw new AccessDeniedError();
  return handler(req);
 }};
 const svc=new SupportService(kernel,{resolve:async()=>db},()=>({tenantId:T,whatsappAccountId:account}));
 const unexpected=async(fn,code)=>{
  await client.query("SAVEPOINT sp_negative");
  await assert.rejects(fn(),error=>error.code===code);
  await client.query("ROLLBACK TO SAVEPOINT sp_negative");
  await client.query("RELEASE SAVEPOINT sp_negative");
 };
 try{
  await client.query("BEGIN");
  await client.query("CREATE SCHEMA "+schema);
  await client.query("SET LOCAL search_path TO "+schema);
  for(const migration of migrations)await client.query(strip(await source(migration)));
  await client.query(strip(await source("../sql/001_support_cases.sql")));
  assert.equal((await client.query("SELECT count(*)::int n FROM support_queues")).rows[0].n,5);
  assert.equal((await client.query("SELECT count(*)::int n FROM pg_indexes WHERE schemaname=current_schema() AND indexname LIKE 'platform_legacy_single_%'")).rows[0].n,2,
    "Support must not change physical 002 multi-org gate");
  await client.query("INSERT INTO platform_organizations(tenant_id,id,display_name,is_default) VALUES($1,$2,'Syndes',true)",[T,org]);
  await client.query("INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug,is_default) VALUES($1,$2,$3,'Principal','principal',true)",[T,ws,org]);
  for(const id of ["external-agent","ti-agent"]){
   await client.query("INSERT INTO platform_org_memberships(tenant_id,organization_id,principal_id,role) VALUES($1,$2,$3,'editor')",[T,org,id]);
   await client.query("INSERT INTO platform_workspace_memberships(tenant_id,organization_id,workspace_id,principal_id,role) VALUES($1,$2,$3,$4,'editor')",[T,org,ws,id]);
  }
  for(const [queue,user] of [["it_infra","ti-agent"],["product","product-agent"],["external_general","external-agent"]]){
   await client.query("INSERT INTO support_queue_memberships(tenant_id,queue_code,principal_id,role,granted_by) VALUES($1,$2,$3,'agent','ci-operator')",[T,queue,user]);
  }

  assert.equal((await client.query("SELECT count(*)::int n FROM support_queue_membership_audit")).rows[0].n,3,
   "Each privileged queue grant must be audited by the database trigger");
  await unexpected(()=>client.query("DELETE FROM support_queue_memberships WHERE principal_id='product-agent'"),"23514");
  await client.query("SELECT set_config('syndes.support_actor_id','ci-operator',true)");
  await client.query("DELETE FROM support_queue_memberships WHERE principal_id='product-agent'");
  assert.equal((await client.query("SELECT count(*)::int n FROM support_queue_membership_audit WHERE action='revoked'")).rows[0].n,1);
  await client.query("INSERT INTO support_queue_memberships(tenant_id,queue_code,principal_id,role,granted_by) VALUES($1,'product','product-agent','agent','ci-operator')",[T]);
  // Internal requester gets only own record; another employee has neither own nor queue access.
  const ticket=await svc.createInternal(actor("employee"),{queue:"it_infra",priority:"normal",description:"Solicitar acesso à impressora"});
  assert.equal(ticket.kind,"internal");assert.equal(ticket.status,"new");assert.match(ticket.protocol,/^SYN-/);
  const own=await svc.list(actor("employee"),"internal",{});
  assert.deepEqual(own.map(x=>x.id),[ticket.id]);
  assert.deepEqual(await svc.list(actor("other-employee"),"internal",{}),[]);
  assert.equal(await svc.get(actor("product-agent"),"internal",ticket.id),null);
  assert.equal(await svc.get(actor("platform-admin"),"internal",ticket.id).catch(e=>e instanceof AccessDeniedError?"denied":e),"denied");
  assert.equal((await svc.list(actor("ti-agent"),"internal",{})).length,1);
  assert.equal((await svc.list(actor("product-agent"),"internal",{})).length,0);
  assert.equal(await svc.note(actor("product-agent"),"internal",ticket.id,{body:"Not allowed"}),null);
  await svc.note(actor("ti-agent"),"internal",ticket.id,{body:"Nota confidencial"});
  const requesterEvents=await svc.history(actor("employee"),"internal",ticket.id);
  assert.equal(requesterEvents.some(x=>x.action==="internal_note"),false,
    "Requester can never read private agent notes");
  const agentEvents=await svc.history(actor("ti-agent"),"internal",ticket.id);
  assert.equal(agentEvents.some(x=>x.action==="internal_note"),true);
  assert.equal((await svc.status(actor("ti-agent"),"internal",ticket.id,{status:"triage"})).status,"triage");
  assert.equal(await svc.status(actor("ti-agent"),"internal",ticket.id,{status:"closed"}).then(x=>x?.status),"closed");
  assert.equal((await svc.status(actor("ti-agent"),"internal",ticket.id,{status:"triage"})).status,"triage");
  assert.equal(await svc.transferQueue(actor("ti-agent"),"internal",ticket.id,{queue:"product"}),null,
    "Transfer requires membership in both source and destination queues");
  assert.equal((await svc.assign(actor("ti-agent"),"internal",ticket.id,{assigneeId:"ti-agent"})).assignedTo,"ti-agent");

  // A second synthetic tenant row must never enter Syndes' SQL lists.
  await client.query("INSERT INTO support_cases(tenant_id,id,kind,channel,requester_id,queue_code,priority) VALUES($1,$2,'internal','form','employee','it_infra','normal')",[caseTenant,randomUUID()]);
  assert.deepEqual((await svc.list(actor("employee"),"internal",{})).map(x=>x.id),[ticket.id]);

  // Dedicated Syndes WhatsApp account, CRM contact and same-org Inbox route.
  await client.query("INSERT INTO crm_people(tenant_id,id,name) VALUES($1,$2,'Synthetic Contact')",[T,p]);
  for(const id of [account,foreignAccount])
   await client.query("INSERT INTO whatsapp_accounts(tenant_id,id,display_name) VALUES($1,$2,'CI test account')",[T,id]);
  await client.query("INSERT INTO inbox_conversations(tenant_id,id,subject,crm_person_id,channel) VALUES($1,$2,'Synthetic WA',$3,'whatsapp')",[T,conversation,p]);
  await client.query("INSERT INTO whatsapp_conversation_routes(tenant_id,conversation_id,account_id,recipient_external_id) VALUES($1,$2,$3,'synthetic@jid')",[T,conversation,account]);
  const external=await svc.createExternal(actor("external-agent"),{conversationId:conversation,priority:"high"});
  assert.equal(external.kind,"external");assert.equal(external.conversationId,conversation);
  assert.equal(external.crmPersonId,p);
  assert.deepEqual((await svc.list(actor("external-agent"),"external",{})).map(x=>x.id),[external.id]);
  assert.deepEqual(await svc.list(actor("ti-agent"),"external",{}),[]);
  await unexpected(()=>svc.createExternal(actor("external-agent"),{conversationId:conversation,priority:"high"}),"23505");
  await client.query("INSERT INTO inbox_conversations(tenant_id,id,subject,crm_person_id,channel) VALUES($1,$2,'Another account',$3,'whatsapp')",[T,foreignConversation,p]);
  await client.query("INSERT INTO whatsapp_conversation_routes(tenant_id,conversation_id,account_id,recipient_external_id) VALUES($1,$2,$3,'other@jid')",[T,foreignConversation,foreignAccount]);
  assert.equal(await svc.createExternal(actor("external-agent"),{conversationId:foreignConversation,priority:"normal"}),null,
    "A WhatsApp account of another operation is not accepted");
  assert.equal(await svc.createExternal(actor("ti-agent"),{conversationId:conversation,priority:"normal"}),null);
  assert.equal((await svc.status(actor("external-agent"),"external",external.id,{status:"triage"})).status,"triage");
  assert.equal((await svc.status(actor("external-agent"),"external",external.id,{status:"in_progress"})).status,"in_progress");
  assert.equal((await svc.status(actor("external-agent"),"external",external.id,{status:"resolved"})).status,"resolved");
  assert.equal((await svc.status(actor("external-agent"),"external",external.id,{status:"closed"})).status,"closed");
  assert.equal((await svc.status(actor("external-agent"),"external",external.id,{status:"triage"})).status,"triage");
  const messageCount=(await client.query("SELECT count(*)::int n FROM inbox_messages")).rows[0].n;
  await svc.note(actor("external-agent"),"external",external.id,{body:"Somente equipe Syndes"});
  assert.equal((await client.query("SELECT count(*)::int n FROM inbox_messages")).rows[0].n,messageCount,
    "Support notes must never write to Inbox or outbound");
  assert.equal((await client.query("SELECT count(*)::int n FROM support_case_events WHERE tenant_id=$1 AND case_id=$2",[T,external.id])).rows[0].n,7);
 }finally{
  await client.query("ROLLBACK");
  assert.equal((await client.query("SELECT to_regnamespace($1) AS schema",[schema])).rows[0].schema,null);
  await client.end();
 }
});
