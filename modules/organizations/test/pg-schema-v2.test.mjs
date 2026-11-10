import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import pg from "pg";

const url=process.env.SYNDES_ORG_TEST_PG_URL;
const files=["001_account_hierarchy","002_legacy_single_context_gate",
 "003_legacy_ownership","004_whatsapp_route_owner_guard",
 "005_scoped_relationship_integrity","006_context_creation_audit",
 "007_staff_roles_pre_release"];
const tA="11111111-1111-4111-8111-111111111111";
const tB="22222222-2222-4222-8222-222222222222";
const oA="33333333-3333-4333-8333-333333333333";
const oB="44444444-4444-4444-8444-444444444444";
const wA="55555555-5555-4555-8555-555555555555";
const wB="66666666-6666-4666-8666-666666666666";
const pA="77777777-7777-4777-8777-777777777777";
const pB="88888888-8888-4888-8888-888888888888";
const empA="99999999-9999-4999-8999-999999999999";

test("AK-40.01: schema-v2 candidate installs, replays, enforces 002 and org integrity in PG17",{
 skip:!url&&"Requires explicit local disposable PostgreSQL 17",timeout:120000
},async()=>{
 const u=new URL(url);
 if(!["localhost","127.0.0.1"].includes(u.hostname)||
    u.username!=="postgres"||!u.password.includes("ci-only-disposable")||
    u.pathname!=="/postgres")
   throw Error("Refusing database URL that is not the isolated CI PostgreSQL");
 const admin=new pg.Client({connectionString:u.href});
 await admin.connect();
 const database="syndes_org_v2_ci_"+randomUUID().replaceAll("-","").slice(0,12);
 let db,created=false;
 const sql=async name=>readFile(new URL("../sql/schema-v2/"+name+".sql",import.meta.url),"utf8");
 const query=async(s,args)=>db.query(s,args);
 const fixtures=[
 "CREATE SCHEMA crm; CREATE SCHEMA inbox; CREATE SCHEMA whatsapp;",
 "CREATE TABLE crm.crm_people(tenant_id uuid NOT NULL,id uuid NOT NULL,name text,archived_at timestamptz,PRIMARY KEY(tenant_id,id));",
 "CREATE TABLE crm.crm_organizations(tenant_id uuid NOT NULL,id uuid NOT NULL,PRIMARY KEY(tenant_id,id));",
 "CREATE TABLE crm.crm_tags(tenant_id uuid NOT NULL,id uuid NOT NULL,label_key text,PRIMARY KEY(tenant_id,id));",
 "CREATE TABLE crm.crm_channel_identities(tenant_id uuid NOT NULL,person_id uuid NOT NULL,channel text NOT NULL,external_id text NOT NULL);",
 "CREATE TABLE crm.crm_person_organizations(tenant_id uuid,person_id uuid,organization_id uuid);",
 "CREATE TABLE crm.crm_person_tags(tenant_id uuid,person_id uuid,tag_id uuid);",
 "CREATE TABLE crm.crm_employees(tenant_id uuid NOT NULL,id uuid NOT NULL,person_id uuid NOT NULL,active boolean NOT NULL DEFAULT true,PRIMARY KEY(tenant_id,id),FOREIGN KEY(tenant_id,person_id) REFERENCES crm.crm_people(tenant_id,id));",
 "CREATE TABLE inbox.inbox_conversations(tenant_id uuid NOT NULL,id uuid NOT NULL,crm_person_id uuid,status text DEFAULT 'open',updated_at timestamptz DEFAULT now(),channel text DEFAULT 'whatsapp',external_thread_id text,PRIMARY KEY(tenant_id,id));",
 "CREATE TABLE inbox.inbox_messages(tenant_id uuid NOT NULL,id uuid NOT NULL,conversation_id uuid NOT NULL,PRIMARY KEY(tenant_id,id));",
 "CREATE TABLE whatsapp.whatsapp_accounts(tenant_id uuid NOT NULL,id uuid NOT NULL,PRIMARY KEY(tenant_id,id));",
 "CREATE TABLE whatsapp.whatsapp_conversation_routes(tenant_id uuid NOT NULL,account_id uuid NOT NULL,conversation_id uuid NOT NULL);",
 "CREATE TABLE whatsapp.whatsapp_outbox(tenant_id uuid NOT NULL,account_id uuid NOT NULL,inbox_message_id uuid);",
 ].join("\n");
 try{
  await admin.query("CREATE DATABASE "+database); created=true;
  u.pathname="/"+database;
  db=new pg.Client({connectionString:u.href});await db.connect();
  await query("CREATE SCHEMA organizations");
  await query(fixtures);
  await query("SET search_path=public,pg_catalog");
  for(const migration of files)await query(await sql(migration));
  for(const migration of files)await query(await sql(migration));
  const objects=await query("SELECT table_schema,table_name FROM information_schema.tables WHERE table_name LIKE 'platform_%' ORDER BY table_schema,table_name");
  assert.ok(objects.rows.length>=14);
  assert.ok(objects.rows.every(x=>x.table_schema==="organizations"),"No platform tables may escape to public");
  const physicalGate=await query("SELECT indexname FROM pg_indexes WHERE schemaname='organizations' AND indexname IN('platform_legacy_single_organization','platform_legacy_single_workspace')");
  assert.equal(physicalGate.rowCount,2,"SQL 002 indexes survive replay");
  // A public shadow must not hijack schema-qualified triggers.
  await query("CREATE TABLE public.platform_organizations(tenant_id uuid,id uuid,display_name text,is_default boolean)");
  await query("INSERT INTO public.platform_organizations(tenant_id,id,display_name,is_default) VALUES($1,$2,'Decoy',true)",[tA,randomUUID()]);
  const insertOrg=async(t,o)=>query("INSERT INTO organizations.platform_organizations(tenant_id,id,display_name,is_default) VALUES($1,$2,'Default',true)",[t,o]);
  await insertOrg(tA,oA);await insertOrg(tB,oB);
  const insertWs=async(t,o,w)=>query("INSERT INTO organizations.platform_workspaces(tenant_id,organization_id,id,name,slug,is_default) VALUES($1,$2,$3,'Principal','principal',true)",[t,o,w]);
  await insertWs(tA,oA,wA);await insertWs(tB,oB,wB);
  const denied=async(fn,codes)=>assert.rejects(fn(),err=>codes.includes(err.code));
  await denied(()=>insertOrg(tA,randomUUID()),["23505"]);
  await denied(()=>insertWs(tA,oA,randomUUID()),["23505"]);
  await query("INSERT INTO organizations.platform_org_memberships(tenant_id,organization_id,principal_id,role) VALUES ($1,$2,'owner','admin'),($1,$2,'agent','editor'),($3,$4,'outsider','admin')",[tA,oA,tB,oB]);
  await query("INSERT INTO organizations.platform_workspace_memberships(tenant_id,organization_id,workspace_id,principal_id,role) VALUES ($1,$2,$3,'owner','admin'),($1,$2,$3,'agent','editor'),($4,$5,$6,'outsider','admin')",[tA,oA,wA,tB,oB,wB]);
  await denied(()=>query("INSERT INTO organizations.platform_workspace_memberships(tenant_id,organization_id,workspace_id,principal_id,role) VALUES($1,$2,$3,'outsider','admin')",[tA,oA,wA]),["23503"]);
  await query("INSERT INTO crm.crm_people(tenant_id,id,name) VALUES($1,$2,'Employee A'),($3,$4,'Employee B')",[tA,pA,tB,pB]);
  await query("INSERT INTO crm.crm_employees(tenant_id,id,person_id) VALUES($1,$2,$3)",[tA,empA,pA]);
  const own=await query("SELECT platform_organization_id FROM crm.crm_people WHERE tenant_id=$1 AND id=$2",[tA,pA]);
  assert.equal(own.rows[0].platform_organization_id,oA,"Trigger must reference organizations schema");
  await denied(()=>query("INSERT INTO crm.crm_people(tenant_id,id,name,platform_organization_id) VALUES($1,$2,'Forged',$3)",[tA,randomUUID(),oB]),["23503"]);
  const routeAccount=randomUUID(),conversation=randomUUID();
  await query("INSERT INTO whatsapp.whatsapp_accounts(tenant_id,id) VALUES($1,$2)",[tA,routeAccount]);
  await query("INSERT INTO inbox.inbox_conversations(tenant_id,id,crm_person_id) VALUES($1,$2,$3)",[tA,conversation,pA]);
  await query("INSERT INTO whatsapp.whatsapp_conversation_routes(tenant_id,account_id,conversation_id) VALUES($1,$2,$3)",[tA,routeAccount,conversation]);
  await denied(()=>query("INSERT INTO whatsapp.whatsapp_conversation_routes(tenant_id,account_id,conversation_id) VALUES($1,$2,$3)",[tB,routeAccount,conversation]),["23514"]);
  const routeOwner=await query("SELECT platform_organization_id FROM inbox.inbox_conversations WHERE id=$1",[conversation]);
  assert.equal(routeOwner.rows[0].platform_organization_id,oA);
  const pLink=await query("INSERT INTO organizations.platform_staff_identity_links(tenant_id,organization_id,id,employee_id,principal_id,bound_by) VALUES($1,$2,$3,$4,'agent','owner') RETURNING id",[tA,oA,randomUUID(),empA]);
  assert.equal(pLink.rowCount,1);
  await query("UPDATE organizations.platform_org_memberships SET state='revoked' WHERE tenant_id=$1 AND organization_id=$2 AND principal_id='agent'",[tA,oA]);
  await denied(()=>query("INSERT INTO organizations.platform_staff_identity_links(tenant_id,organization_id,id,employee_id,principal_id,bound_by) VALUES($1,$2,$3,$4,'agent','owner')",[tA,oA,randomUUID(),empA]),["23505","42501"]);
  await denied(()=>query("DELETE FROM organizations.platform_staff_access_audit"),["42501"]);
  await query("SELECT organizations.platform_backfill_legacy_ownership($1,'owner')",[tA]);
  const counts=await query("SELECT count(*)::int n FROM organizations.platform_legacy_backfill_runs WHERE tenant_id=$1",[tA]);
  assert.equal(counts.rows[0].n,1);
  // A failed concurrent write is fully reversible through a savepoint.
  await query("BEGIN");
  await query("SAVEPOINT org_write");
  await denied(()=>insertOrg(tA,randomUUID()),["23505"]);
  await query("ROLLBACK TO SAVEPOINT org_write");
  const intact=await query("SELECT count(*)::int n FROM organizations.platform_organizations WHERE tenant_id=$1",[tA]);
  assert.equal(intact.rows[0].n,1);
  await query("COMMIT");
  await query(await sql("002_legacy_single_context_gate"));
  await denied(()=>insertOrg(tA,randomUUID()),["23505"]);
 }finally{
  if(db)await db.end().catch(()=>{});
  if(created)await admin.query("DROP DATABASE "+database+" WITH (FORCE)").catch(()=>{});
  await admin.end();
 }
});
