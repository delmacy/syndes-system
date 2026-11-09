import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import pg from "pg";
import {OrganizationService} from "../dist/service.js";

const url=process.env.SYNDES_ORG_TEST_PG_URL;
const tenant="11111111-1111-4111-8111-111111111111";
const outsider="22222222-2222-4222-8222-222222222222";
const actor=(id,tenantId=tenant)=>({tenantId,actor:{id,kind:"user"}});
const source=async relative=>readFile(new URL(relative,import.meta.url),"utf8");
const stripTransactions=s=>s.replace(/^\s*(?:BEGIN|COMMIT);\s*$/gim,"");
test("legacy CRM, Inbox and WhatsApp owner migration is idempotent, atomic, role-gated and preserves IDs",{
 skip:!url&&"requires disposable PostgreSQL"
},async()=>{
 const client=new pg.Client({connectionString:url});
 await client.connect();
 const schema="org_legacy_"+randomUUID().replaceAll("-","").slice(0,15);
 const person=randomUUID(),person2=randomUUID(),crmOrg=randomUUID(),tag=randomUUID();
 const conversation=randomUUID(),msg=randomUUID(),wa=randomUUID(),routeAccount=randomUUID();
 const employee=randomUUID(),channelId=randomUUID(),note=randomUUID();
 try{
  await client.query("BEGIN");
  await client.query("CREATE SCHEMA "+schema);
  await client.query("SET LOCAL search_path TO "+schema);
  // Real legacy migration schemas in dependency order, no external gateway.
  for(const f of [
    "../../core-crm/sql/001_crm_foundation.sql",
    "../../core-crm/sql/002_crm_tags_notes.sql",
    "../../core-crm/sql/003_crm_employees_channels.sql",
    "../../inbox/sql/001_inbox_foundation.sql",
    "../../whatsapp/sql/001_whatsapp_accounts.sql",
    "../../whatsapp/sql/002_whatsapp_inbound.sql",
    "../../whatsapp/sql/003_whatsapp_outbound_inbox.sql",
  ]){
    await client.query(stripTransactions(await source(f)));
  }
  await client.query(await source("../sql/001_account_hierarchy.sql"));
  await client.query(await source("../sql/002_legacy_single_context_gate.sql"));
  // Actual legacy data precedes owner columns and default context.
  await client.query("INSERT INTO crm_people(tenant_id,id,name) VALUES($1,$2,'Maria')",[tenant,person]);
  await client.query("INSERT INTO crm_organizations(tenant_id,id,legal_name) VALUES($1,$2,'Client company')",[tenant,crmOrg]);
  await client.query("INSERT INTO crm_person_organizations(tenant_id,person_id,organization_id) VALUES($1,$2,$3)",[tenant,person,crmOrg]);
  await client.query("INSERT INTO crm_tags(tenant_id,id,label,label_key) VALUES($1,$2,'Lead','lead')",[tenant,tag]);
  await client.query("INSERT INTO crm_person_tags(tenant_id,person_id,tag_id) VALUES($1,$2,$3)",[tenant,person,tag]);
  await client.query("INSERT INTO crm_notes(tenant_id,id,person_id,body,created_by) VALUES($1,$2,$3,'Legacy note','alice')",[tenant,note,person]);
  await client.query("INSERT INTO crm_employees(tenant_id,id,person_id,job_title) VALUES($1,$2,$3,'Agent')",[tenant,employee,person]);
  await client.query("INSERT INTO crm_channel_identities(tenant_id,id,person_id,channel,external_id) VALUES($1,$2,$3,'whatsapp','test@example')",[tenant,channelId,person]);
  await client.query("INSERT INTO inbox_conversations(tenant_id,id,crm_person_id,subject) VALUES($1,$2,$3,'Existing conversation')",[tenant,conversation,person]);
  await client.query("INSERT INTO inbox_messages(tenant_id,id,conversation_id,direction,body,author_id) VALUES($1,$2,$3,'inbound','Original message','contact')",[tenant,msg,conversation]);
  await client.query("INSERT INTO whatsapp_accounts(tenant_id,id,display_name) VALUES($1,$2,'Existing number')",[tenant,wa]);
  await client.query("INSERT INTO whatsapp_conversation_routes(tenant_id,conversation_id,account_id,recipient_external_id) VALUES($1,$2,$3,'test@server')",[tenant,conversation,wa]);

  const ownershipSql=await source("../sql/003_legacy_ownership.sql");
  await client.query(ownershipSql);
  await client.query(ownershipSql); // idempotent operator migration
  const db={tenantId:tenant,query:async(sql,args)=>{
   const r=await client.query(sql,args);return {rows:r.rows,rowCount:r.rowCount};
  }};
  const kernel={execute:async(_q,callback)=>callback()};
  const svc=new OrganizationService(kernel,{resolve:async()=>db});
  // First check: no administrator or default context means NO backfill.
  assert.equal(await svc.backfillDefaultOwnership(actor("alice")),null);
  assert.deepEqual(await svc.bootstrap(actor("alice")),{initialized:true});
  const [org]=await svc.listOrganizations(actor("alice"));
  const [ws]=await svc.listWorkspaces(actor("alice"),org.id);
  assert.equal(await svc.backfillDefaultOwnership(actor("bob")),null);
  // No owner was written by a member without default admin role.
  const before=await client.query("SELECT platform_organization_id FROM crm_people WHERE tenant_id=$1 AND id=$2",[tenant,person]);
  assert.equal(before.rows[0].platform_organization_id,null);

  const first=await svc.backfillDefaultOwnership(actor("alice"));
  assert.deepEqual(first,[
    {entityType:"crm_people",updatedCount:1},
    {entityType:"crm_organizations",updatedCount:1},
    {entityType:"crm_tags",updatedCount:1},
    {entityType:"inbox_conversations",updatedCount:1},
    {entityType:"whatsapp_accounts",updatedCount:1}
  ]);
  assert.deepEqual((await svc.backfillDefaultOwnership(actor("alice"))).map(x=>x.updatedCount),[0,0,0,0,0]);
  for(const table of ["crm_people","crm_organizations","crm_tags","inbox_conversations","whatsapp_accounts"]){
   const r=await client.query("SELECT tenant_id,platform_organization_id FROM "+table+" WHERE tenant_id=$1",[tenant]);
   assert.equal(r.rows.length,1);
   assert.equal(r.rows[0].platform_organization_id,org.id);
  }
  const conv=await client.query("SELECT platform_origin_workspace_id,platform_current_workspace_id FROM inbox_conversations WHERE tenant_id=$1 AND id=$2",[tenant,conversation]);
  assert.equal(conv.rows[0].platform_origin_workspace_id,ws.id);
  assert.equal(conv.rows[0].platform_current_workspace_id,ws.id);
  // The canonical history and all dependent IDs are untouched.
  for(const [table,id] of [
    ["crm_person_organizations",person],["crm_person_tags",person],
    ["crm_notes",note],["crm_employees",employee],
    ["crm_channel_identities",channelId],["inbox_messages",msg],
    ["whatsapp_conversation_routes",conversation]
  ]){
   const column=["crm_person_organizations","crm_person_tags"].includes(table)?"person_id":
     table==="whatsapp_conversation_routes"?"conversation_id":"id";
   const r=await client.query("SELECT 1 FROM "+table+" WHERE tenant_id=$1 AND "+column+"=$2",[tenant,id]);
   assert.equal(r.rowCount,1,table+" must preserve history");
  }

  // Newly inserted records inherit default owner even through legacy APIs.
  await client.query("INSERT INTO crm_people(tenant_id,id,name) VALUES($1,$2,'New after bootstrap')",[tenant,person2]);
  const newConversation=randomUUID(),newAccount=randomUUID();
  await client.query("INSERT INTO inbox_conversations(tenant_id,id,subject) VALUES($1,$2,'New thread')",[tenant,newConversation]);
  await client.query("INSERT INTO whatsapp_accounts(tenant_id,id,display_name) VALUES($1,$2,'New phone')",[tenant,newAccount]);
  const newRows=await client.query(
   "SELECT platform_organization_id FROM crm_people WHERE tenant_id=$1 AND id=$2",[tenant,person2]);
  assert.equal(newRows.rows[0].platform_organization_id,org.id);
  const nconv=await client.query(
   "SELECT platform_organization_id,platform_origin_workspace_id,platform_current_workspace_id FROM inbox_conversations WHERE tenant_id=$1 AND id=$2",
   [tenant,newConversation]);
  assert.equal(nconv.rows[0].platform_organization_id,org.id);
  assert.equal(nconv.rows[0].platform_origin_workspace_id,ws.id);
  assert.equal(nconv.rows[0].platform_current_workspace_id,ws.id);
  const naccount=await client.query("SELECT platform_organization_id FROM whatsapp_accounts WHERE tenant_id=$1 AND id=$2",[tenant,newAccount]);
  assert.equal(naccount.rows[0].platform_organization_id,org.id);

  async function rejectsAtomic(sql,args,code){
   await client.query("SAVEPOINT forbidden");
   await assert.rejects(client.query(sql,args),e=>e.code===code);
   await client.query("ROLLBACK TO SAVEPOINT forbidden");
  }
  await rejectsAtomic("UPDATE crm_people SET platform_organization_id=$3 WHERE tenant_id=$1 AND id=$2",
   [tenant,person,randomUUID()],"23514");
  await rejectsAtomic("UPDATE inbox_conversations SET platform_origin_workspace_id=$3 WHERE tenant_id=$1 AND id=$2",
   [tenant,conversation,randomUUID()],"23514");
  // Backfill fails closed when 002 guard is absent.
  await client.query("SAVEPOINT no_guard");
  await client.query("DROP INDEX platform_legacy_single_organization");
  await rejectsAtomic("SELECT * FROM platform_backfill_legacy_ownership($1::uuid)",[tenant],"P0001");
  await client.query("ROLLBACK TO SAVEPOINT no_guard");
  // Other tenant without any default context remains invisible to the actor.
  await assert.rejects(svc.backfillDefaultOwnership(actor("alice",outsider)),/Database mismatch/);
 }finally{
  await client.query("ROLLBACK");
  await client.end();
 }
});
