// Stage-only synthetic historical fixture and post-restore verification.
import {readFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from '/workspace/apps/core-host/node_modules/pg/lib/index.js';

assert.equal(process.env.SYNDES_HISTORICAL_CLONE,'ACTIONS_STAGE_ONLY');
const source=process.env.STAGE_HISTORICAL_SOURCE;
const target=process.env.STAGE_HISTORICAL_TARGET;
const rollback=process.env.STAGE_HISTORICAL_ROLLBACK;
assert.match(source??'',/^syndes_hist_[a-f0-9]{12}_s$/);
assert.equal(target,source.slice(0,-1)+'t');
assert.equal(rollback,source.slice(0,-1)+'r');
const phase=process.argv[2];
assert.ok(['seed','compare','cutover-check','multi-org-deny','rollback-check'].includes(phase));
const tid='11111111-1111-4111-8111-111111111111';
const org='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ws='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const person=randomUUID(),conversation=randomUUID(),account=randomUUID();
const password=(await readFile('/run/stage/pg-admin','utf8')).trim();
const connect=async(db)=>{const c=new pg.Client({host:'control-postgres',user:'postgres',password,database:db,connectionTimeoutMillis:5000});await c.connect();return c};
const sql=async(path)=>readFile('/run/bundle/sql/'+path,'utf8');
const migrations=[
 'core-crm/001_crm_foundation.sql','core-crm/002_crm_tags_notes.sql',
 'core-crm/003_crm_employees_channels.sql','inbox/001_inbox_foundation.sql',
 ...['whatsapp_accounts','whatsapp_inbound','whatsapp_outbound_inbox',
 'whatsapp_conversation_phone','whatsapp_history','whatsapp_contact_names',
 'whatsapp_delivery_receipts'].map((name,i)=>'whatsapp/'+String(i+1).padStart(3,'0')+'_'+name+'.sql'),
 'organizations/001_account_hierarchy.sql','organizations/002_legacy_single_context_gate.sql'];
const queryState=async(db)=>{
 const c=await connect(db);
 try{
  await c.query('SET search_path TO historical');
  const tables=['crm_people','crm_organizations','crm_tags','inbox_conversations','whatsapp_accounts'];
  const rows=[];
  for(const table of tables){
   const r=await c.query('SELECT id::text,platform_organization_id::text AS org FROM '+table+' WHERE tenant_id=$1 ORDER BY id',[tid]);
   rows.push([table,r.rows]);
  }
  const conv=(await c.query('SELECT id::text,platform_origin_workspace_id::text AS origin,platform_current_workspace_id::text AS current FROM inbox_conversations WHERE tenant_id=$1 ORDER BY id',[tid])).rows;
  const audit=(await c.query('SELECT counts FROM platform_legacy_backfill_runs WHERE tenant_id=$1 ORDER BY id',[tid])).rows;
  const indexes=(await c.query("SELECT indexname FROM pg_indexes WHERE schemaname='historical' AND indexname LIKE 'platform_legacy_single_%' ORDER BY indexname")).rows.map(r=>r.indexname);
  return {rows,conv,audit,indexes};
 }finally{await c.end()}
};
if(phase==='seed'){
 const c=await connect(source);
 let started=false;
 try{
  await c.query('BEGIN');started=true;
  await c.query('CREATE SCHEMA historical');
  await c.query('SET LOCAL search_path TO historical');
  for(const path of migrations)await c.query((await sql(path)).replace(/^\s*(?:BEGIN|COMMIT);\s*$/gim,''));
  await c.query('INSERT INTO platform_organizations(tenant_id,id,display_name,is_default) VALUES($1,$2,$3,true)',[tid,org,'Historical synthetic org']);
  await c.query('INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug,is_default) VALUES($1,$2,$3,$4,$5,true)',[tid,ws,org,'Historical workspace','historical']);
  await c.query("INSERT INTO platform_org_memberships(tenant_id,organization_id,principal_id,role) VALUES($1,$2,'stage-historical-operator','admin')",[tid,org]);
  await c.query("INSERT INTO platform_workspace_memberships(tenant_id,organization_id,workspace_id,principal_id,role) VALUES($1,$2,$3,'stage-historical-operator','admin')",[tid,org,ws]);
  await c.query('INSERT INTO crm_people(tenant_id,id,name) VALUES($1,$2,$3)',[tid,person,'Synthetic legacy contact']);
  await c.query('INSERT INTO crm_organizations(tenant_id,id,legal_name) VALUES($1,$2,$3)',[tid,randomUUID(),'Synthetic legacy company']);
  await c.query('INSERT INTO crm_tags(tenant_id,id,label,label_key) VALUES($1,$2,$3,$4)',[tid,randomUUID(),'Synthetic legacy tag','legacy']);
  await c.query("INSERT INTO inbox_conversations(tenant_id,id,subject,crm_person_id,channel,external_thread_id) VALUES($1,$2,$3,$4,'whatsapp','same-external')",[tid,conversation,'Synthetic legacy thread',person]);
  await c.query('INSERT INTO whatsapp_accounts(tenant_id,id,display_name) VALUES($1,$2,$3)',[tid,account,'Synthetic legacy account']);
  for(const path of ['organizations/003_legacy_ownership.sql','organizations/004_whatsapp_route_owner_guard.sql',
   'organizations/005_scoped_relationship_integrity.sql','organizations/006_context_creation_audit.sql',
   'organizations/008_iam07d_revoke_first_candidate.sql',
   'organizations/010_iam07d_cutover_capabilities_candidate.sql'])await c.query(await sql(path));
  const backfill=await c.query("SELECT entity_type,updated_count::int AS n FROM platform_backfill_legacy_ownership($1::uuid,'stage-historical-operator')",[tid]);
  assert.deepEqual(backfill.rows.map(x=>x.n),[1,1,1,1,1]);
  await c.query('COMMIT');started=false;
  console.log('STAGE_HISTORICAL_SOURCE_COMMITTED_SYNTHETIC_ONLY_PASS');
 }finally{if(started)await c.query('ROLLBACK');await c.end()}
}else if(phase==='compare'){
 const [s,t]=await Promise.all([queryState(source),queryState(target)]);
 assert.deepEqual(s,t);
 assert.equal(s.indexes.length,2);
 assert.deepEqual(s.audit[0].counts,{crm_people:1,crm_organizations:1,crm_tags:1,inbox_conversations:1,whatsapp_accounts:1});
 for(const [,rows] of s.rows){assert.equal(rows.length,1);assert.equal(rows[0].org,org)}
 assert.equal(s.conv[0].origin,ws);assert.equal(s.conv[0].current,ws);
 console.log('STAGE_HISTORICAL_RESTORED_IDS_OWNERS_AUDIT_SQL002_HASH='+createHash('sha256').update(JSON.stringify(s)).digest('hex'));
 console.log('STAGE_HISTORICAL_RESTORED_SOURCE_TARGET_IDENTICAL_PASS');
}else if(phase==='cutover-check'){
 const s=await queryState(source),t=await queryState(target);
 assert.equal(s.indexes.length,2);
 assert.equal(t.indexes.length,0);
 assert.deepEqual(s.rows,t.rows);
 assert.deepEqual(s.conv,t.conv);
 assert.deepEqual(s.audit,t.audit);
 console.log('STAGE_HISTORICAL_PSQL_SINGLE_TRANSACTION_SOURCE_UNCHANGED_TARGET_CUTOVER_PASS');
}else if(phase==='multi-org-deny'){
 const c=await connect(target);
 try{
  await c.query('BEGIN');
  await c.query('SET LOCAL search_path TO historical');
  const secondOrg=randomUUID(),secondWs=randomUUID();
  await c.query('INSERT INTO platform_organizations(tenant_id,id,display_name) VALUES($1,$2,$3)',[tid,secondOrg,'Second synthetic organization']);
  await c.query('INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug) VALUES($1,$2,$3,$4,$5)',[tid,secondWs,secondOrg,'Second synthetic workspace','second']);
  await c.query('COMMIT');
  await c.query('BEGIN');
  await c.query('SET LOCAL search_path TO historical');
  await c.query('SAVEPOINT forbidden_legacy_rollback');
  try{
   await assert.rejects(c.query('CREATE UNIQUE INDEX platform_legacy_single_organization ON platform_organizations(tenant_id)'),error=>error.code==='23505');
  }finally{await c.query('ROLLBACK TO SAVEPOINT forbidden_legacy_rollback')}
  assert.equal((await c.query("SELECT count(*)::int n FROM pg_indexes WHERE schemaname='historical' AND indexname LIKE 'platform_legacy_single_%'")).rows[0].n,0);
  await c.query('ROLLBACK');
  console.log('STAGE_HISTORICAL_MULTI_ORG_SQL002_REINSTALL_DENIED_PASS');
 }finally{await c.end()}
}else{
 const [s,r,t]=await Promise.all([queryState(source),queryState(rollback),queryState(target)]);
 assert.deepEqual(s,r);
 assert.equal(s.indexes.length,2);
 assert.equal(r.indexes.length,2);
 assert.equal(t.indexes.length,0);
 const c=await connect(target);
 try{assert.equal((await c.query("SELECT count(*)::int n FROM historical.platform_organizations WHERE tenant_id=$1",[tid])).rows[0].n,2)}finally{await c.end()}
 console.log('STAGE_HISTORICAL_RESTORE_COMPATIBLE_BACKUP_AFTER_TWO_ORGS_PASS');
}
