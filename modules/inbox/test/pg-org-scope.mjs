import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {PgInboxRepository} from "../dist/postgres.js";

const require=createRequire(new URL("../../../apps/core-host/package.json",import.meta.url));
const {Client}=require("pg");
const url=process.env.SYNDES_INBOX_SCOPE_TEST_PG_URL;
const file=rel=>readFile(new URL(rel,import.meta.url),"utf8");
const strip=s=>s.replace(/^\s*(?:BEGIN|COMMIT);\s*$/gim,"");
const T="11111111-1111-4111-8111-111111111111";

test("Inbox SQL isolates Org A/B and Workspace A1/A2 inside one disposable tenant",{
 skip:!url&&"requires disposable PostgreSQL"
},async()=>{
 const c=new Client({connectionString:url});
 await c.connect();
 const schema="inbox_scope_"+randomUUID().replaceAll("-","").slice(0,14);
 const oa=randomUUID(),ob=randomUUID(),w1=randomUUID(),w2=randomUUID(),wb=randomUUID();
 const pa=randomUUID(),pb=randomUUID();
 try{
  await c.query("BEGIN");
  await c.query("CREATE SCHEMA "+schema);
  await c.query("SET LOCAL search_path TO "+schema);
  for(const path of [
   "../../core-crm/sql/001_crm_foundation.sql",
   "../../core-crm/sql/002_crm_tags_notes.sql",
   "../../core-crm/sql/003_crm_employees_channels.sql",
   "../sql/001_inbox_foundation.sql",
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
  ])await c.query(strip(await file(path)));
  // Only this disposable test transaction may lift the physical safety guard.
  await c.query("DROP INDEX platform_legacy_single_organization");
  await c.query("DROP INDEX platform_legacy_single_workspace");
  await c.query("INSERT INTO platform_organizations(tenant_id,id,display_name,is_default) VALUES($1,$2,'Alpha',true),($1,$3,'Beta',false)",[T,oa,ob]);
  await c.query("INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug,is_default) VALUES($1,$2,$3,'Alpha One','one',true),($1,$4,$3,'Alpha Two','two',false),($1,$5,$6,'Beta','beta',true)",[T,w1,oa,w2,wb,ob]);
  await c.query("INSERT INTO platform_org_memberships(tenant_id,organization_id,principal_id,role) VALUES($1,$2,'alice','admin'),($1,$3,'bob','admin')",[T,oa,ob]);
  await c.query("INSERT INTO platform_workspace_memberships(tenant_id,organization_id,workspace_id,principal_id,role) VALUES($1,$2,$3,'alice','admin'),($1,$2,$4,'alice','editor'),($1,$5,$6,'bob','admin')",[T,oa,w1,w2,ob,wb]);
  await c.query("INSERT INTO crm_people(tenant_id,id,name,platform_organization_id) VALUES($1,$2,'A Person',$3),($1,$4,'B Person',$5)",[T,pa,oa,pb,ob]);
  const db={tenantId:T,query:async(sql,values)=>{
   const x=await c.query(sql,[...values]);return {rows:x.rows,rowCount:x.rowCount};
  }};
  const a=new PgInboxRepository(db,{organizationId:oa,workspaceId:w1});
  const a2=new PgInboxRepository(db,{organizationId:oa,workspaceId:w2});
  const b=new PgInboxRepository(db,{organizationId:ob,workspaceId:wb});
  const record=(name,person=null)=>({id:randomUUID(),subject:name,crmPersonId:person,externalThreadId:null});
  const ac=await a.create(T,"alice",record("Confidential Alpha",pa));
  const a2c=await a2.create(T,"alice2",record("Alpha workspace two"));
  const bc=await b.create(T,"bob",record("Private Beta",pb));
  const dbOwner=await c.query("SELECT platform_organization_id o,platform_origin_workspace_id origin,platform_current_workspace_id current_ws FROM inbox_conversations WHERE id=$1",[ac.id]);
  assert.deepEqual(dbOwner.rows[0],{o:oa,origin:w1,current_ws:w1});
  assert.deepEqual((await a.list(T,null,100)).map(x=>x.id),[ac.id]);
  assert.deepEqual((await a2.list(T,null,100)).map(x=>x.id),[a2c.id]);
  assert.deepEqual((await b.list(T,null,100)).map(x=>x.id),[bc.id]);
  assert.deepEqual(await a.list(T,null,100,"all","alice","all",0,"Beta"),[]);
  assert.deepEqual(await b.list(T,null,100,"all","bob","all",0,"Alpha"),[]);
  assert.equal(await a.get(T,bc.id),null);
  assert.equal(await b.get(T,ac.id),null);
  assert.equal(await a2.get(T,ac.id),null);
  assert.equal(await b.messages(T,ac.id,100),null);
  assert.equal(await a2.messages(T,ac.id,100),null);
  assert.equal(await a.assign(T,bc.id,"alice","alice"),null);
  assert.equal(await a2.status(T,ac.id,"alice2","resolved"),null);
  assert.equal(await b.handoff(T,ac.id,"bob","bot"),null);
  assert.equal(await b.append(T,ac.id,"bob",{id:randomUUID(),direction:"inbound",body:"cross",externalMessageId:"x"}),null);
  assert.equal(await a2.append(T,ac.id,"alice2",{id:randomUUID(),direction:"inbound",body:"cross",externalMessageId:"y"}),null);
  assert.deepEqual(await a.metrics(T),{open:1,pending:0,resolved:0,unassigned:1});
  assert.deepEqual(await b.metrics(T),{open:1,pending:0,resolved:0,unassigned:1});
  assert.deepEqual(await a2.metrics(T),{open:1,pending:0,resolved:0,unassigned:1});
  await assert.rejects(a.create(T,"alice",record("Invalid CRM owner",pb)),/Invalid CRM reference/);
  await assert.rejects(b.create(T,"bob",record("Invalid CRM owner",pa)),/Invalid CRM reference/);
  const wa=randomUUID();
  await c.query("INSERT INTO inbox_conversations(tenant_id,id,subject,channel,platform_organization_id,platform_origin_workspace_id,platform_current_workspace_id) VALUES($1,$2,'Alpha WhatsApp','whatsapp',$3,$4,$4)",[T,wa,oa,w1]);
  assert.equal(await a.linkContact(T,wa,"alice",pb),null);
  assert.equal(await b.linkContact(T,wa,"bob",pa),null);
  assert.equal(await a2.linkContact(T,wa,"alice2",pa),null);
  assert.equal((await a.linkContact(T,wa,"alice",pa)).crmPersonId,pa);
  const foreignAccount=randomUUID();
  await c.query("INSERT INTO whatsapp_accounts(tenant_id,id,display_name,platform_organization_id) VALUES($1,$2,'B Account',$3)",[T,foreignAccount,ob]);
  await c.query("INSERT INTO whatsapp_conversation_routes(tenant_id,conversation_id,account_id,recipient_external_id,phone_e164) VALUES($1,$2,$3,'friend@device','+5551999990000')",[T,wa,foreignAccount]);
  assert.deepEqual(await a.list(T,null,100,"all","alice","all",0,"+5551999990000"),[]);
  await a.assign(T,ac.id,"alice","alice");
  const reply=await a.append(T,ac.id,"alice",{id:randomUUID(),direction:"outbound",body:"Private reply",externalMessageId:null});
  assert.equal(reply.direction,"outbound");
  assert.deepEqual((await a.messages(T,ac.id,10)).map(x=>x.body),["Private reply"]);
  assert.equal(await a2.messages(T,ac.id,10),null);
  assert.equal(await b.messages(T,ac.id,10),null);
  const before=await c.query("SELECT count(*)::int AS count FROM inbox_events WHERE tenant_id=$1 AND conversation_id=$2",[T,ac.id]);
  await a2.status(T,ac.id,"alice2","resolved");
  await b.assign(T,ac.id,"bob","bob");
  assert.equal((await c.query("SELECT count(*)::int AS count FROM inbox_events WHERE tenant_id=$1 AND conversation_id=$2",[T,ac.id])).rows[0].count,before.rows[0].count);
  assert.equal((await a.get(T,ac.id)).status,"open");
  // A transfer must be owner-preserving, atomic, audited and gated on
  // ACTIVE editor/admin memberships in both the source and destination.
  assert.equal(await a.transferWorkspace(T,bc.id,"alice",w2),null);
  assert.equal(await a.transferWorkspace(T,ac.id,"alice",wb),null);
  assert.equal(await a.transferWorkspace(T,ac.id,"intruder",w2),null);
  await c.query("UPDATE platform_workspace_memberships SET state='revoked' WHERE tenant_id=$1 AND organization_id=$2 AND workspace_id=$3 AND principal_id='alice'",[T,oa,w2]);
  assert.equal(await a.transferWorkspace(T,ac.id,"alice",w2),null);
  await c.query("UPDATE platform_workspace_memberships SET state='active' WHERE tenant_id=$1 AND organization_id=$2 AND workspace_id=$3 AND principal_id='alice'",[T,oa,w2]);
  const moved=await a.transferWorkspace(T,ac.id,"alice",w2);
  assert.equal(moved.id,ac.id,"Transfer must never change the conversation ID");
  const inherited=await c.query("SELECT platform_organization_id AS owner,platform_origin_workspace_id AS origin,platform_current_workspace_id AS current_ws,crm_person_id FROM inbox_conversations WHERE id=$1",[ac.id]);
  assert.deepEqual(inherited.rows[0],{owner:oa,origin:w1,current_ws:w2,crm_person_id:pa});
  assert.equal(await a.get(T,ac.id),null);
  assert.equal((await a2.get(T,ac.id)).id,ac.id);
  assert.equal(await b.get(T,ac.id),null);
  assert.deepEqual((await a2.messages(T,ac.id,100)).map(x=>x.body),["Private reply"],"History preserved when reassigning workspace");
  assert.equal(await a.transferWorkspace(T,ac.id,"alice",w2),null);
  assert.equal(await a2.transferWorkspace(T,ac.id,"bob",w1),null);
  const audit=await c.query("SELECT actor_id,action,detail FROM inbox_events WHERE tenant_id=$1 AND conversation_id=$2 AND action='workspace_transferred'",[T,ac.id]);
  assert.deepEqual(audit.rows,[{actor_id:"alice",action:"workspace_transferred",detail:{from:w1,to:w2}}]);
  const restored=await a2.transferWorkspace(T,ac.id,"alice",w1);
  assert.equal(restored.id,ac.id);
  assert.equal((await a.get(T,ac.id)).id,ac.id);
  assert.equal(await a2.get(T,ac.id),null);
  const audit2=await c.query("SELECT count(*)::int AS n FROM inbox_events WHERE tenant_id=$1 AND conversation_id=$2 AND action='workspace_transferred'",[T,ac.id]);
  assert.equal(audit2.rows[0].n,2);

 }finally{
  await c.query("ROLLBACK");
  await c.end();
 }
});
