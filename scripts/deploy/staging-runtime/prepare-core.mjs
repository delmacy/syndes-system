// Stage operator: verified SQL/module receipts and explicit pilot grants.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import pg from '/workspace/apps/core-host/node_modules/pg/lib/index.js';
import {iam07dFineObjectForScope} from '/workspace/apps/core-host/dist/iam07d-fine-fga-policy.js';
import {IAM07D_CAPABILITIES,iam07dScopeKind} from '/workspace/apps/core-host/dist/iam07d-capability-catalog.js';
const ROOT='/run/stage/';
const tid='1f5a8ce9-3f01-48cc-a013-2198d99e7510';
const dbName='syndes_tenant_'+tid.replaceAll('-','');
const tenantRole='syndes_t_'+tid.replaceAll('-','');
const A='a3f80cc7-4c61-4f8e-8c39-d848dfbe10a1',B='b4f80cc7-4c61-4f8e-8c39-d848dfbe10b2';
const A1='cae8c1e2-4a1d-4b69-9e02-0dd15b0d1001',B1='cbe8c1e2-4a1d-4b69-9e02-0dd15b0d2001';
const sha=x=>createHash('sha256').update(x).digest('hex');
const check=x=>{if(!x)throw Error('Stage invariant')};
const file=async n=>(await readFile(ROOT+n,'utf8')).trim();
let phase='safety';
let checkpoint='start';
async function fga(path,body){
 const r=await fetch('http://openfga:8080'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(5000)});
 check(r.ok);const t=await r.text();return t?JSON.parse(t):null;
}
async function main(){
 check(process.env.SYNDES_STAGE_CORE_PREPARE==='ACTIONS_STAGE_ONLY');
 check(/^sha256:[a-f0-9]{64}$/.test(process.env.STAGE_IMAGE_DIGEST||''));
 const password=await file('pg-admin');
 const control=new pg.Pool({host:'control-postgres',user:'postgres',password,database:'syndes_staging_control',max:1});
 const tenant=new pg.Pool({host:'control-postgres',user:'postgres',password,database:dbName,max:1});
 try{
  phase='scope';
  check((await tenant.query('SELECT current_database() AS name')).rows[0].name===dbName);
  check((await control.query('SELECT state FROM tenant_registry WHERE tenant_id=$1',[tid])).rows[0]?.state==='active');
  check((await tenant.query("SELECT count(*)::int n FROM platform_organizations WHERE tenant_id=$1",[tid])).rows[0].n===2);
  const founder=(await control.query('SELECT founder_id::text AS id FROM platform_signup_intents WHERE tenant_id=$1 AND state=\'ready\'',[tid])).rows[0]?.id;
  const restricted=(await control.query('SELECT principal_id AS id FROM tenant_memberships WHERE tenant_id=$1 AND principal_id<>$2 AND state=\'active\'',[tid,founder])).rows[0]?.id;
  check(founder&&restricted&&founder!==restricted);
  const store=await file('pilot-fga-store-id');check(/^[A-Za-z0-9_-]{8,128}$/.test(store));
  let bootstrap;
  try{bootstrap=JSON.parse(await file('core-pilot-bootstrap.json'))}catch(e){if(e.code!=='ENOENT')throw e;}
  if(bootstrap)check(bootstrap.founder===founder&&bootstrap.restricted===restricted&&bootstrap.store===store);
  phase='oidc-client-audience';
  const adminTokenResponse=await fetch('https://identity-stage:8443/realms/master/protocol/openid-connect/token',{
   method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},redirect:'error',signal:AbortSignal.timeout(10000),
   body:new URLSearchParams({grant_type:'client_credentials',client_id:'syndes-stage-pilot-recovery',client_secret:await file('pilot-admin-service-secret')})});
  check(adminTokenResponse.ok);const adminToken=(await adminTokenResponse.json()).access_token;
  const kc=async(path,body)=>{
   const r=await fetch('https://identity-stage:8443/admin/realms/syndes-pilot'+path,{
    method:body?'POST':'GET',headers:{Authorization:'Bearer '+adminToken,'Content-Type':'application/json'},
    body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(10000)});
   check(r.ok);const t=await r.text();return t?JSON.parse(t):null;
  };
  const clients=await kc('/clients?clientId=syndes-pilot-staging-login');check(clients.length===1);
  const mappers=await kc('/clients/'+clients[0].id+'/protocol-mappers/models');
  if(!mappers.some(x=>x.name==='stage-core-audience')){
   check(!bootstrap);
   await kc('/clients/'+clients[0].id+'/protocol-mappers/models',{
    name:'stage-core-audience',protocol:'openid-connect',protocolMapper:'oidc-audience-mapper',
    config:{'included.custom.audience':'syndes-core','access.token.claim':'true','id.token.claim':'false'}});
  }
  phase='schema';
  // Versioned owner SQL, not browser filenames. Legacy SQL002 is deliberately
  // excluded: this NEW synthetic tenant is already post-cutover.
  const specs=[['crm','@syndes/core-crm'],['inbox','@syndes/core-inbox'],['whatsapp','@syndes/whatsapp'],['organizations','@syndes/core-organizations'],['service','@syndes/service']];
  const plugins=[];
  for(const [id,pkg] of specs){
   const {syndesPlugin:p}=await import('/workspace/apps/core-host/node_modules/'+pkg+'/dist/plugin.js');
   check(p.definition.id===id&&p.definition.schema===id);
   plugins.push(p);
  }
  await tenant.query(await readFile('/run/bundle/tenant-module-ledger.schema','utf8'));
  await tenant.query(`CREATE TABLE IF NOT EXISTS _syndes.stage_bootstrap_receipts(module_id text,migration_id text,checksum text NOT NULL,verification_mode text NOT NULL,verified_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(module_id,migration_id))`);
  const records=[];
  // Create all base tables before owner FK guards. Replaying additive schema is
  // permitted only when no prior verified ledger exists for the same checksum.
  const order=[...plugins.filter(p=>p.definition.id!=='organizations'&&p.definition.id!=='service'),plugins.find(p=>p.definition.id==='organizations'),plugins.find(p=>p.definition.id==='service')];
  for(const p of order){
   const migrations=[];
   for(const m of p.migrations){
    if(m.id==='002_legacy_single_context_gate')continue;
    const sql=await readFile(new URL(m.fileUrl),'utf8'),checksum=sha(sql);
    if(p.definition.id==='whatsapp'&&m.id==='009_whatsapp_history_commands'){
     // 009 is an independently approved, stage-only schema preparation (MO-REL01).
     // It is NOT part of the immutable WhatsApp module 0.1.0 installation
     // receipt, which attests 001..008. Verify the separate attestation and
     // physical objects instead of silently changing a previously enabled
     // module's digest or reinstalling it without an upgrade transition.
     const prepared=(await tenant.query(`SELECT checksum,verification_mode FROM
      _syndes.stage_bootstrap_receipts WHERE module_id=$1 AND migration_id=$2`,
      [p.definition.id,m.id])).rows[0];
     check(prepared?.checksum===checksum&&prepared?.verification_mode==='stage_prepared_before_activation');
     const already=(await tenant.query('SELECT checksum FROM _syndes.module_migrations WHERE module_id=$1 AND migration_id=$2',
      [p.definition.id,m.id])).rows[0];
     if(already)check(already.checksum===checksum);
     const proof=(await tenant.query(`SELECT
      to_regclass('public.whatsapp_history_commands') IS NOT NULL AS command_table,
      to_regclass('public.whatsapp_history_commands_pending') IS NOT NULL AS pending_index,
      to_regclass('public.whatsapp_history_commands_anchor') IS NOT NULL AS anchor_index`)).rows[0];
     check(proof.command_table&&proof.pending_index&&proof.anchor_index);
     continue;
    }
    if(p.definition.id==='service'){
     // Service was installed by the earlier stage workflow before SQL002
     // removal. Never replay its immutable single-context 002 on multi-org.
     const proof=(await tenant.query(`SELECT
      to_regprocedure('service.service_team_can_read(uuid,uuid,uuid,uuid,text)') IS NOT NULL AS team,
      EXISTS(SELECT 1 FROM pg_constraint WHERE conname='service_team_workspace_fk' AND convalidated) AS fk,
      to_regclass('service.service_attendance_inspector_conversation_idx') IS NOT NULL AS inspector,
      position('team_id' in pg_get_functiondef('service.service_funnel_attendance_guard()'::regprocedure))>0 AS guard`)).rows[0];
     check(proof.team&&proof.fk&&proof.inspector&&proof.guard);
     const old=(await tenant.query('SELECT checksum FROM _syndes.stage_bootstrap_receipts WHERE module_id=$1 AND migration_id=$2',[p.definition.id,m.id])).rows[0];
     if(old)check(old.checksum===checksum);
     else await tenant.query('INSERT INTO _syndes.stage_bootstrap_receipts(module_id,migration_id,checksum,verification_mode) VALUES($1,$2,$3,$4)',[p.definition.id,m.id,checksum,'verified_existing_post_cutover']);
     migrations.push({id:m.id,checksum,mode:'verified_existing_post_cutover'});continue;
    }
    const old=await tenant.query('SELECT checksum FROM _syndes.module_migrations WHERE module_id=$1 AND migration_id=$2',[p.definition.id,m.id]);
    if(old.rowCount)check(old.rows[0].checksum===checksum);
    else{
     await tenant.query(sql);
     await tenant.query('INSERT INTO _syndes.module_migrations(module_id,migration_id,version,checksum,image_digest) VALUES($1,$2,$3,$4,$5)',[p.definition.id,m.id,p.definition.version,checksum,process.env.STAGE_IMAGE_DIGEST]);
    }
    migrations.push({id:m.id,checksum});
   }
   // The snapshot attests the actual replayed owner SQL, not a dummy schema.
   records.push({id:p.definition.id,version:p.definition.version,schema:p.definition.schema,
    dependencies:(p.definition.dependencies||[]).filter(x=>x!=='platform'),receipt:sha(JSON.stringify(migrations))});
  }
  check((await tenant.query("SELECT count(*)::int n FROM pg_indexes WHERE indexname IN ('platform_legacy_single_organization','platform_legacy_single_workspace')")).rows[0].n===0);
  // Dedicated runtime role loses all DDL/ownership in this stage database.
  await tenant.query('REASSIGN OWNED BY '+tenantRole+' TO postgres');
  await tenant.query('ALTER DATABASE '+dbName+' OWNER TO postgres');
  await tenant.query('REVOKE CREATE ON SCHEMA public, service FROM PUBLIC, '+tenantRole);
  await tenant.query('GRANT USAGE ON SCHEMA public,service TO '+tenantRole);
  await tenant.query('GRANT SELECT ON ALL TABLES IN SCHEMA public,service TO '+tenantRole);
  const tables=(await tenant.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','service') AND (tablename LIKE 'crm_%' OR tablename LIKE 'inbox_%' OR tablename LIKE 'whatsapp_%' OR schemaname='service' OR tablename IN ('platform_org_audit','platform_units','platform_workspace_units'))")).rows;
  for(const t of tables)await tenant.query('GRANT INSERT,UPDATE,DELETE ON '+t.schemaname+'.'+t.tablename+' TO '+tenantRole);
  await tenant.query('GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public,service TO '+tenantRole);
  // Row locks require UPDATE privilege; changed_at cannot turn a revoked fence active.
  await tenant.query('GRANT UPDATE(changed_at) ON platform_iam_capability_fences TO '+tenantRole);
  for(const t of ['platform_organizations','platform_workspaces','platform_org_memberships','platform_workspace_memberships'])
   await tenant.query('GRANT UPDATE ON '+t+' TO '+tenantRole);
  await tenant.query('REVOKE ALL ON SCHEMA _syndes FROM '+tenantRole);
  phase='control-modules';
  for(const name of ['control-module-attestation.schema','control-module-activation.schema']){
   checkpoint='schema:'+name.replace('.schema','');
   await control.query(await readFile('/run/bundle/'+name,'utf8'));
  }
  for(const r of records){
   checkpoint='catalog:'+r.id;
   await control.query('INSERT INTO module_catalog(module_id,schema_name) VALUES($1,$2) ON CONFLICT DO NOTHING',[r.id,r.schema]);
   await control.query("INSERT INTO module_catalog_versions(module_id,version,approved,approved_at,approved_by) VALUES($1,$2,true,clock_timestamp(),'system:stage-actions') ON CONFLICT DO NOTHING",[r.id,r.version]);
   for(const dep of r.dependencies)await control.query('INSERT INTO module_catalog_dependencies(module_id,version,dependency_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[r.id,r.version,dep]);
  }
  // Dependency order matters for installation attestations and activation.
  for(const id of ['crm','inbox','whatsapp','organizations','service']){
   checkpoint='install:'+id;
   const r=records.find(x=>x.id===id);
   const old=(await control.query('SELECT * FROM tenant_module_installs WHERE tenant_id=$1 AND module_id=$2',[tid,id])).rows[0];
   if(old){check(old.state==='enabled'&&old.installed_version===r.version&&old.verification_digest===r.receipt);continue}
   await control.query('SELECT transition_tenant_module_entitlement($1,$2,$3,$4,$5,$6)',[tid,id,'grant',randomUUID(),'system:stage-actions','Explicit isolated staging authorization']);
   await control.query('SELECT transition_tenant_module_install_intent($1,$2,$3,$4,$5,$6,$7)',[tid,id,r.version,'request',randomUUID(),'system:stage-actions','Verified staging owner SQL']);
   await control.query('SELECT attest_tenant_module_install($1,$2,$3,$4,$5,$6,$7)',[tid,id,r.version,r.receipt,randomUUID(),'system:stage-actions','Replayed owner SQL and protected ledger verified']);
   await control.query('SELECT transition_tenant_module_activation($1,$2,$3,$4,$5,$6,$7,$8)',[tid,id,r.version,r.receipt,'enable',randomUUID(),'system:stage-actions','User-authorized isolated staging runtime']);
  }
  phase='explicit-grants';
  const coarse=[];
  for(const p of plugins)for(const permission of p.permissions)for(const actor of [founder,restricted]){
   if(p.definition.id==='organizations'&&permission.resource!=='organizations:directory')continue;
   coarse.push({user:'user:'+actor,relation:'viewer',object:'resource:'+sha(tid+'|'+permission.resource)});
   if(permission.actions.includes('write'))coarse.push({user:'user:'+actor,relation:'editor',object:'resource:'+sha(tid+'|'+permission.resource)});
  }
  const fine=[];
  for(const [principalId,org,ws] of [[founder,A,A1],[restricted,B,B1]]){
   const funnels=(await tenant.query("SELECT id::text FROM service.service_funnels WHERE tenant_id=$1 AND organization_id=$2 AND workspace_id=$3 AND state='published'",[tid,org,ws])).rows;
   for(const capability of IAM07D_CAPABILITIES.filter(x=>!x.endsWith('history_sync'))){
    if(!bootstrap)await tenant.query("INSERT INTO platform_iam_capability_fences(tenant_id,organization_id,workspace_id,principal_id,capability,epoch,state) VALUES($1,$2,$3,$4,$5,1,'active') ON CONFLICT DO NOTHING",[tid,org,ws,principalId,capability]);
    for(const suffix of iam07dScopeKind(capability)==='funnel'?funnels.map(f=>':funnel:'+f.id):['']){
     const resourceName='syndes:v1:tenant:'+tid+':org:'+org+':workspace:'+ws+suffix;
     const object=iam07dFineObjectForScope({tenantId:tid,organizationId:org,workspaceId:ws,capability,resourceName});
     fine.push({user:'user:'+principalId,relation:'grantee',object});
    }
   }
  }
  for(const tuple of [...new Map([...coarse,...fine].map(x=>[JSON.stringify(x),x])).values()]){
   const permission=tuple.relation==='grantee'?'can_execute':tuple.relation==='editor'?'can_write':'can_read';
   const allowed=(await fga('/stores/'+store+'/check',{tuple_key:{...tuple,relation:permission}})).allowed;
   if(!allowed){
    check(!bootstrap); // Ready replay NEVER recreates a revoked grant.
    await fga('/stores/'+store+'/write',{writes:{tuple_keys:[tuple]}});
   }
  }
  if(!bootstrap)await writeFile(ROOT+'core-pilot-bootstrap.json',JSON.stringify({founder,restricted,store}),{flag:'wx',mode:0o600});
  await writeFile('/run/runtime/core.env','STAGE_CORE_IMAGE='+process.env.STAGE_CORE_IMAGE+'\nSTAGE_FGA_STORE_ID='+store+'\n',{mode:0o644});
  console.log('STAGE_CORE_OWNER_SQL_LEDGER_MODULE_ENABLED_EXPLICIT_FINE_GRANTS_PASS');
 }finally{await tenant.end();await control.end()}
}
main().catch(error=>{
 const sqlstate=typeof error?.code==='string'&&/^[0-9A-Z]{5}$/.test(error.code)?error.code:'invariant';
 // Report only deterministic step and SQLSTATE, never SQL, values or secrets.
 console.error('STAGE_CORE_PREPARE_BLOCKED='+phase+':'+checkpoint+':'+sqlstate);
 process.exitCode=1;
});
