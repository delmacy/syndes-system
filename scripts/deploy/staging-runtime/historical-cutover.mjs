// MO-REL-06: exercise real historical SQL in an isolated, rollback-only schema.
// This script never selects a tenant database or commits its fixture.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from '/workspace/apps/core-host/node_modules/pg/lib/index.js';

assert.equal(process.env.SYNDES_STAGE_HISTORICAL,'ACTIONS_STAGE_ONLY');
const tenant='11111111-1111-4111-8111-111111111111';
const schema='historical_'+randomUUID().replaceAll('-','').slice(0,20);
const org=randomUUID(),workspace=randomUUID(),person=randomUUID(),conversation=randomUUID();
const account=randomUUID(),crmOrg=randomUUID(),tag=randomUUID();
const client=new pg.Client({host:'control-postgres',user:'postgres',
 password:(await readFile('/run/stage/pg-admin','utf8')).trim(),database:'postgres',
 connectionTimeoutMillis:5000});
const sql=async(path)=>readFile('/run/bundle/sql/'+path,'utf8');
const run=async(path)=>client.query((await sql(path)).replace(/^\s*(?:BEGIN|COMMIT);\s*$/gim,''));
async function denied(statement,code='23514'){
 await client.query('SAVEPOINT expected_deny');
 try{
  await assert.rejects(client.query(statement),error=>error.code===code);
 }finally{
  await client.query('ROLLBACK TO SAVEPOINT expected_deny');
  await client.query('RELEASE SAVEPOINT expected_deny');
 }
}
let began=false;
try{
 await client.connect();
 await client.query('BEGIN');began=true;
 await client.query('CREATE SCHEMA '+schema);
 await client.query('SET LOCAL search_path TO '+schema);
 for(const migration of [
  'core-crm/001_crm_foundation.sql','core-crm/002_crm_tags_notes.sql',
  'core-crm/003_crm_employees_channels.sql','inbox/001_inbox_foundation.sql',
  ...[1,2,3,4,5,6,7].map((n)=>'whatsapp/'+String(n).padStart(3,'0')+'_'+
   ['whatsapp_accounts','whatsapp_inbound','whatsapp_outbound_inbox','whatsapp_conversation_phone','whatsapp_history','whatsapp_contact_names','whatsapp_delivery_receipts'][n-1]+'.sql'),
  'organizations/001_account_hierarchy.sql',
  'organizations/002_legacy_single_context_gate.sql'
 ])await run(migration);
 // Historical records precede nullable owner columns and backfill.
 await client.query('INSERT INTO platform_organizations(tenant_id,id,display_name,is_default) VALUES($1,$2,$3,true)',[tenant,org,'Legacy default']);
 await client.query('INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug,is_default) VALUES($1,$2,$3,$4,$5,true)',[tenant,workspace,org,'Legacy workspace','legacy']);
 await client.query("INSERT INTO platform_org_memberships(tenant_id,organization_id,principal_id,role) VALUES($1,$2,'stage-historical-admin','admin')",[tenant,org]);
 await client.query("INSERT INTO platform_workspace_memberships(tenant_id,organization_id,workspace_id,principal_id,role) VALUES($1,$2,$3,'stage-historical-admin','admin')",[tenant,org,workspace]);
 await client.query('INSERT INTO crm_people(tenant_id,id,name) VALUES($1,$2,$3)',[tenant,person,'Historical synthetic person']);
 await client.query('INSERT INTO crm_organizations(tenant_id,id,legal_name) VALUES($1,$2,$3)',[tenant,crmOrg,'Historical synthetic company']);
 await client.query('INSERT INTO crm_tags(tenant_id,id,label,label_key) VALUES($1,$2,$3,$4)',[tenant,tag,'Historical synthetic tag','historical']);
 await client.query("INSERT INTO inbox_conversations(tenant_id,id,subject,crm_person_id,channel,external_thread_id) VALUES($1,$2,$3,$4,'whatsapp','same-thread')",[tenant,conversation,'Historical synthetic conversation',person]);
 await client.query('INSERT INTO whatsapp_accounts(tenant_id,id,display_name) VALUES($1,$2,$3)',[tenant,account,'Historical synthetic account']);
 const owner=(table)=>client.query('SELECT platform_organization_id FROM '+table+' WHERE tenant_id=$1',[tenant]);
 for(const migration of [
  'organizations/003_legacy_ownership.sql','organizations/004_whatsapp_route_owner_guard.sql',
  'organizations/005_scoped_relationship_integrity.sql','organizations/006_context_creation_audit.sql'
 ])await run(migration);
 const singleFence=await sql('organizations/008_iam07d_revoke_first_candidate.sql');
 const multiFence=await sql('organizations/009_iam_multiorg_fence_candidate.sql');
 const capabilityCutover=await sql('organizations/010_iam07d_cutover_capabilities_candidate.sql');
 await denied(multiFence,'55000'); // never install multi-org fence while SQL002 remains
 await client.query(singleFence);
 await client.query(capabilityCutover);
 assert.equal((await client.query('SELECT count(*)::int n FROM platform_iam_capability_fences')).rows[0].n,0);
 for(const table of ['crm_people','crm_organizations','crm_tags','inbox_conversations','whatsapp_accounts'])
  assert.equal((await owner(table)).rows[0].platform_organization_id,null);
 const cutover=await sql('organizations/manual/activate_multiple_organizations.sql');
 await denied(cutover); // missing attestation and unowned history
 const backfill=await client.query("SELECT entity_type,updated_count::int AS n FROM platform_backfill_legacy_ownership($1::uuid,'stage-historical-admin')",[tenant]);
 assert.deepEqual(backfill.rows.map(r=>r.n),[1,1,1,1,1]);
 for(const table of ['crm_people','crm_organizations','crm_tags','inbox_conversations','whatsapp_accounts'])
  assert.equal((await owner(table)).rows[0].platform_organization_id,org);
 const history=(await client.query('SELECT id,platform_origin_workspace_id,platform_current_workspace_id FROM inbox_conversations WHERE id=$1',[conversation])).rows[0];
 assert.deepEqual(history,{id:conversation,platform_origin_workspace_id:workspace,platform_current_workspace_id:workspace});
 await denied(cutover); // backfill alone does not authorize release
 await client.query("SELECT set_config('syndes.multi_context_gate','approved',true),set_config('syndes.restorable_backup','verified',true),set_config('syndes.scoped_host','verified',true)");
 await client.query('SAVEPOINT partial_gate');
 await client.query('DROP INDEX platform_legacy_single_organization');
 await denied(cutover);
 await denied(capabilityCutover,'55000');
 await client.query('ROLLBACK TO SAVEPOINT partial_gate');
 assert.equal((await client.query("SELECT count(*)::int n FROM pg_indexes WHERE schemaname=current_schema() AND indexname LIKE 'platform_legacy_single_%'")).rows[0].n,2);
 await client.query(cutover);
 await client.query(multiFence);
 await client.query(capabilityCutover);
 await client.query(capabilityCutover); // replay must not introduce grants
 await denied(singleFence,'55000');
 assert.equal((await client.query('SELECT count(*)::int n FROM platform_iam_capability_fences')).rows[0].n,0);
 assert.equal((await client.query("SELECT count(*)::int n FROM pg_indexes WHERE schemaname=current_schema() AND indexname LIKE 'platform_legacy_single_%'")).rows[0].n,0);
 assert.deepEqual((await client.query('SELECT id,platform_origin_workspace_id,platform_current_workspace_id FROM inbox_conversations WHERE id=$1',[conversation])).rows[0],history);
 const secondOrg=randomUUID(),secondWs=randomUUID();
 await client.query('INSERT INTO platform_organizations(tenant_id,id,display_name) VALUES($1,$2,$3)',[tenant,secondOrg,'Second synthetic org']);
 await client.query('INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug) VALUES($1,$2,$3,$4,$5)',[tenant,secondWs,secondOrg,'Second workspace','second']);
 await denied("INSERT INTO crm_people(tenant_id,id,name) VALUES('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','No owner')");
 assert.equal((await client.query("SELECT count(*)::int n FROM platform_legacy_backfill_runs WHERE tenant_id=$1 AND organization_id=$2",[tenant,org])).rows[0].n,1);
 console.log('STAGE_HISTORICAL_LEGACY_ROWS_BACKFILL_PARTIAL_DENY_SQL002_IAM008_009_010_CUTOVER_ROLLBACK_PASS');
}finally{
 if(began)await client.query('ROLLBACK');
 const leftover=await client.query('SELECT to_regnamespace($1) AS value',[schema]);
 assert.equal(leftover.rows[0].value,null,'Historical fixture must be rolled back');
 await client.end();
}
