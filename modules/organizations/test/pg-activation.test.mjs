import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import pg from "pg";
import {OrganizationService} from "../dist/service.js";
import {AccessDeniedError} from "@syndes/core-kernel";

const url=process.env.SYNDES_ORG_TEST_PG_URL;
const T="11111111-1111-4111-8111-111111111111";
const source=rel=>readFile(new URL(rel,import.meta.url),"utf8");
const strip=s=>s.replace(/^\s*(?:BEGIN|COMMIT);\s*$/gim,"");

/** The manual cutover is exercised ONLY in a rollbacked isolated PG schema.
 * Production unique indexes are NEVER modified by this test.
 */
test("manual multi-org cutover fails without attestations, preserves owners and enables scoped uniqueness",{
 skip:!url&&"requires disposable PostgreSQL"
},async()=>{
 const client=new pg.Client({connectionString:url});
 await client.connect();
 const schema="activation_"+randomUUID().replaceAll("-","").slice(0,16);
 const o1=randomUUID(),w1=randomUUID();
 let o2=randomUUID(),w2=randomUUID();
 const p1=randomUUID(),p2=randomUUID(),tag1=randomUUID(),tag2=randomUUID();
 const c1=randomUUID(),c2=randomUUID(),ch1=randomUUID(),ch2=randomUUID();
 const crmOrg1=randomUUID(),crmOrg2=randomUUID();
 const failed=async(sql,params=[],expected="23514")=>{
  await client.query("SAVEPOINT denied_action");
  await assert.rejects(client.query(sql,params),e=>e.code===expected,
    "SQL must reject forbidden cross-organization write");
  await client.query("ROLLBACK TO SAVEPOINT denied_action");
  await client.query("RELEASE SAVEPOINT denied_action");
 };
 try{
  await client.query("BEGIN");
  await client.query("CREATE SCHEMA "+schema);
  await client.query("SET LOCAL search_path TO "+schema);
  for(const migration of [
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
   "../sql/001_account_hierarchy.sql",
   "../sql/002_legacy_single_context_gate.sql",
   "../sql/003_legacy_ownership.sql",
   "../sql/004_whatsapp_route_owner_guard.sql",
   "../sql/005_scoped_relationship_integrity.sql",
   "../sql/006_context_creation_audit.sql"
  ])await client.query(strip(await source(migration)));
  // Migrations 005 and 006 must be safely replayable after an interrupted
  // deployment. Re-executing them must not relax any owner constraint.
  await client.query(strip(await source("../sql/005_scoped_relationship_integrity.sql")));
  await client.query(strip(await source("../sql/006_context_creation_audit.sql")));
  const releaseSql=await source("../sql/manual/activate_multiple_organizations.sql");
  // No bootstrap/backfill and no attestation => one SQL23514, all indexes intact.
  await failed(releaseSql,[],"23514");
  assert.equal((await client.query("SELECT count(*)::int n FROM pg_indexes WHERE schemaname=current_schema() AND indexname LIKE 'platform_legacy_single_%'")).rows[0].n,2);
  await client.query("INSERT INTO platform_organizations(tenant_id,id,display_name,is_default) VALUES($1,$2,'Original Org',true)",[T,o1]);
  await client.query("INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug,is_default) VALUES($1,$2,$3,'Original Workspace','original',true)",[T,w1,o1]);
  await client.query("INSERT INTO platform_org_memberships(tenant_id,organization_id,principal_id,role) VALUES($1,$2,'authorized-admin','admin'),($1,$2,'viewer','viewer')",[T,o1]);
  await client.query("INSERT INTO platform_workspace_memberships(tenant_id,organization_id,workspace_id,principal_id,role) VALUES($1,$2,$3,'authorized-admin','admin'),($1,$2,$3,'viewer','viewer')",[T,o1,w1]);
  await client.query("INSERT INTO platform_legacy_backfill_runs(tenant_id,organization_id,actor_id,counts) VALUES($1,$2,'authorized-admin','{}'::jsonb)",[T,o1]);
  await client.query("INSERT INTO crm_people(tenant_id,id,name) VALUES($1,$2,'Old CRM contact')",[T,p1]);
  await client.query("INSERT INTO inbox_conversations(tenant_id,id,subject,crm_person_id,channel,external_thread_id) VALUES($1,$2,'Original Conversation',$3,'whatsapp','hash-same')",[T,c1,p1]);
  const before=await client.query("SELECT platform_organization_id org,platform_origin_workspace_id origin,platform_current_workspace_id current_ws FROM inbox_conversations WHERE id=$1",[c1]);
  assert.deepEqual(before.rows[0],{org:o1,origin:w1,current_ws:w1});
  // Missing attestations must NEVER remove indexes, even with backfill.
  await failed(releaseSql,[],"23514");
  await client.query("SELECT set_config('syndes.multi_context_gate','approved',true)");
  await client.query("SELECT set_config('syndes.restorable_backup','verified',true)");
  await client.query("SELECT set_config('syndes.scoped_host','verified',true)");
  await client.query(releaseSql);
  assert.equal((await client.query("SELECT count(*)::int n FROM pg_indexes WHERE schemaname=current_schema() AND indexname LIKE 'platform_legacy_single_%'")).rows[0].n,0);
  const retained=await client.query("SELECT id,platform_organization_id org,platform_origin_workspace_id origin,platform_current_workspace_id current_ws FROM inbox_conversations WHERE id=$1",[c1]);
  assert.deepEqual(retained.rows[0],{id:c1,org:o1,origin:w1,current_ws:w1});
  const provider={resolve:async()=>({tenantId:T,query:async(sql,args)=>{
   const x=await client.query(sql,[...args]);return {rows:x.rows,rowCount:x.rowCount};
  }})};
  const records=[];
  const kernel={execute:async(q,fn)=>{records.push(q);return fn();}};
  const service=new OrganizationService(kernel,provider);
  const adminCtx={tenantId:T,actor:{id:"authorized-admin",kind:"user"}};
  const viewerCtx={tenantId:T,actor:{id:"viewer",kind:"user"}};
  const previous=process.env.SYNDES_MULTI_ORG_ENABLED;
  try{
    delete process.env.SYNDES_MULTI_ORG_ENABLED;
    assert.throws(()=>service.createOrganization(adminCtx,{displayName:"Other Org"}),/disabled/);
    process.env.SYNDES_MULTI_ORG_ENABLED="true";
    const created=await service.createOrganization(adminCtx,{displayName:"Other Org"});
    assert.equal(created?.display_name,"Other Org");
    o2=created.id;
    w2=created.default_workspace_id;
    const scopedWorkspace=await service.createWorkspace(adminCtx,o1,{name:"Sales",slug:"sales"});
    assert.equal(scopedWorkspace?.organization_id,o1);
    assert.equal((await client.query("SELECT count(*)::int n FROM platform_workspace_memberships WHERE tenant_id=$1 AND workspace_id=$2 AND principal_id='authorized-admin' AND role='admin'",[T,scopedWorkspace.id])).rows[0].n,1);
    assert.equal(await service.createWorkspace(viewerCtx,o1,{name:"Forbidden",slug:"forbidden"}),null);
    assert.equal(records[0].resource,"organizations:bootstrap");
    assert.equal(records[1].resource,"organizations:workspaces");
    assert.equal(records[1].action,"write");
  }finally{
    if(previous===undefined)delete process.env.SYNDES_MULTI_ORG_ENABLED;
    else process.env.SYNDES_MULTI_ORG_ENABLED=previous;
  }
  // After cutover, implicit owner defaulting is DISABLED.
  await failed("INSERT INTO crm_people(tenant_id,id,name) VALUES($1,$2,'Missing owner')",[T,randomUUID()]);
  await failed("INSERT INTO inbox_conversations(tenant_id,id,subject,channel) VALUES($1,$2,'Missing owner','whatsapp')",[T,randomUUID()]);
  await client.query("INSERT INTO crm_people(tenant_id,id,name,platform_organization_id) VALUES($1,$2,'Other CRM contact',$3)",[T,p2,o2]);
  await client.query("INSERT INTO crm_tags(tenant_id,id,label,label_key,platform_organization_id) VALUES($1,$2,'Prospect','prospect',$3),($1,$4,'Prospect','prospect',$5)",[T,tag1,o1,tag2,o2]);
  await client.query("INSERT INTO crm_channel_identities(tenant_id,id,person_id,channel,external_id) VALUES($1,$2,$3,'whatsapp','same-channel'),($1,$4,$5,'whatsapp','same-channel')",[T,ch1,p1,ch2,p2]);
  const ids=await client.query("SELECT platform_organization_id owner FROM crm_channel_identities WHERE external_id='same-channel' ORDER BY platform_organization_id");
  assert.deepEqual(ids.rows.map(x=>x.owner),[o1,o2].sort());
  await client.query("INSERT INTO inbox_conversations(tenant_id,id,subject,channel,external_thread_id,platform_organization_id,platform_origin_workspace_id,platform_current_workspace_id) VALUES($1,$2,'Other Conversation','whatsapp','hash-same',$3,$4,$4)",[T,c2,o2,w2]);
  assert.equal((await client.query("SELECT count(*)::int n FROM inbox_conversations WHERE external_thread_id='hash-same'")).rows[0].n,2);
  await client.query("INSERT INTO crm_organizations(tenant_id,id,legal_name,platform_organization_id) VALUES($1,$2,'Alpha Customer',$3),($1,$4,'Beta Customer',$5)",[T,crmOrg1,o1,crmOrg2,o2]);
  await failed("INSERT INTO crm_person_tags(tenant_id,person_id,tag_id) VALUES($1,$2,$3)",[T,p1,tag2]);
  await failed("INSERT INTO crm_person_organizations(tenant_id,person_id,organization_id) VALUES($1,$2,$3)",[T,p1,crmOrg2]);
  await failed("INSERT INTO inbox_conversations(tenant_id,id,subject,crm_person_id,platform_organization_id,platform_origin_workspace_id,platform_current_workspace_id) VALUES($1,$2,'Invalid link',$3,$4,$5,$5)",[T,randomUUID(),p2,o1,w1]);
  const owner=await client.query("SELECT platform_organization_id org,platform_origin_workspace_id origin,platform_current_workspace_id current_ws FROM inbox_conversations WHERE id=$1",[c1]);
  assert.deepEqual(owner.rows[0],before.rows[0]);
 }finally{
  await client.query("ROLLBACK");
  const clean=await client.query("SELECT to_regnamespace($1) AS schema",[schema]);
  assert.equal(clean.rows[0].schema,null,"All cutover changes rolled back from disposable schema");
  await client.end();
 }
});
