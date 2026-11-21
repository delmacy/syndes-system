// Real stage HTTP/SQL/IdP/FGA/worker/SSE acceptance, synthetic data only.
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from '/workspace/apps/core-host/node_modules/pg/lib/index.js';
import {TenantPgProvider} from '/workspace/apps/core-host/dist/tenant-database.js';
import {WhatsAppInboundStore} from '/workspace/modules/whatsapp/dist/inbound-http.js';
import {WhatsAppOutboundRelay} from '/workspace/modules/whatsapp/dist/outbound-relay.js';
import {iam07dFineObjectForScope} from '/workspace/apps/core-host/dist/iam07d-fine-fga-policy.js';
const tid='1f5a8ce9-3f01-48cc-a013-2198d99e7510';
const A='a3f80cc7-4c61-4f8e-8c39-d848dfbe10a1',B='b4f80cc7-4c61-4f8e-8c39-d848dfbe10b2';
const A1='cae8c1e2-4a1d-4b69-9e02-0dd15b0d1001',B1='cbe8c1e2-4a1d-4b69-9e02-0dd15b0d2001';
const A2='cae8c1e2-4a1d-4b69-9e02-0dd15b0d1002',B2='cbe8c1e2-4a1d-4b69-9e02-0dd15b0d2002';
const KC='https://identity-stage:8443',BASE='http://core-host:8082';
const file=async n=>(await readFile('/run/stage/'+n,'utf8')).trim();
const assert=(v)=>{if(!v)throw Error('Stage assertion')};
let phase='safety';const cleanup=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function eventually(fn,ms=15000){const end=Date.now()+ms;do{if(await fn())return;await sleep(350)}while(Date.now()<end);throw Error('Stage deadline')}
async function oauth(client,secret,username){
 const body=username?{grant_type:'password',client_id:client,username,password:secret}:
 {grant_type:'client_credentials',client_id:client,client_secret:secret};
 const r=await fetch(KC+'/realms/'+(username?'syndes-pilot':'master')+'/protocol/openid-connect/token',{
  method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body),redirect:'error',signal:AbortSignal.timeout(8000)});
 assert(r.status===200);return (await r.json()).access_token;
}
async function api(path,{token,org=A,ws=A1,method='GET',body,statuses=[200],tenant=tid}={}){
 const headers={'Content-Type':'application/json','x-syndes-organization-id':org,'x-syndes-workspace-id':ws};
 if(token)headers.Authorization='Bearer '+token;
 const r=await fetch(BASE+'/v1/tenants/'+tenant+'/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(14000)});
 if(!statuses.includes(r.status)){phase+='_'+method+'_'+path.replace(/[a-f0-9-]{36}/gi,':id').replace(/[^a-zA-Z0-9:_/-]/g,'_')+'_'+r.status;throw Error('HTTP result')}const text=await r.text();let data;
 try{data=JSON.parse(text)}catch{data=text}
 return {status:r.status,data,text};
}
async function stream(token,org,ws){
 const controller=new AbortController();
 const state={events:0,closed:false,stop:()=>controller.abort()};
 const r=await fetch(BASE+'/v1/tenants/'+tid+'/inbox/events',{
  headers:{Authorization:'Bearer '+token,'x-syndes-organization-id':org,'x-syndes-workspace-id':ws},signal:controller.signal});
 assert(r.status===200);const reader=r.body.getReader();
 void(async()=>{const decoder=new TextDecoder();let pending='';try{for(;;){const v=await reader.read();if(v.done)break;pending+=decoder.decode(v.value,{stream:true});let boundary;while((boundary=pending.indexOf('\n\n'))>=0){const event=pending.slice(0,boundary);pending=pending.slice(boundary+2);if(/^event: changed$/m.test(event))state.events++}}}catch{}finally{state.closed=true}})();
 cleanup.push(()=>state.stop());return state;
}
async function main(){
 assert(process.env.SYNDES_STAGE_ACCEPTANCE==='ACTIONS_STAGE_ONLY');
 const bootstrap=JSON.parse(await file('core-pilot-bootstrap.json'));
 const admin=await oauth('syndes-stage-pilot-recovery',await file('pilot-admin-service-secret'));
 const tokenA=await oauth('syndes-pilot-staging-login',await file('pilot-founder-password'),'pilot-founder');
 const tokenB=await oauth('syndes-pilot-staging-login',await file('pilot-b-only-password'),'pilot-b-only');
 const claims=JSON.parse(Buffer.from(tokenA.split('.')[1],'base64url'));
 assert(claims.iss===KC+'/realms/syndes-pilot'&&[claims.aud].flat().includes('syndes-core'));
 const db=new pg.Pool({host:'control-postgres',user:'postgres',password:await file('pg-admin'),database:'syndes_tenant_'+tid.replaceAll('-',''),max:2});
 const control=new pg.Pool({host:'control-postgres',user:'syndes_staging_core',password:await file('core-db-password'),database:'syndes_staging_control',max:2});
 const provider=new TenantPgProvider({db:control});
 try{
  phase='singleton-postgres-lease';
  const lease=(await control.query("SELECT count(*)::int n FROM pg_locks WHERE locktype='advisory' AND granted AND classid=20506 AND objid=20261118 AND objsubid=2 AND database=(SELECT oid FROM pg_database WHERE datname=current_database())")).rows[0];assert(lease.n===1);
  const contender=await control.connect();try{assert((await contender.query('SELECT pg_try_advisory_lock(20506,20261118) AS acquired')).rows[0].acquired===false)}finally{contender.release()}
  console.log('STAGE_ACCEPTANCE_REAL_CONTROL_SINGLETON_SESSION_LOCK_SECOND_OWNER_DENY_PASS');
  phase='negative-tenant-fixture';
  const other='22222222-2222-4222-8222-222222222222',otherDb='syndes_tenant_'+other.replaceAll('-',''),otherRole='syndes_t_'+other.replaceAll('-','');
  const operator=new pg.Pool({host:'control-postgres',user:'postgres',password:await file('pg-admin'),database:'syndes_staging_control',max:1});
  try{
   if(!(await operator.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[otherRole])).rowCount)await operator.query('CREATE ROLE '+otherRole+' NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE');
   if(!(await operator.query('SELECT 1 FROM pg_database WHERE datname=$1',[otherDb])).rowCount)await operator.query('CREATE DATABASE '+otherDb+' OWNER postgres');
   await operator.query('REVOKE CONNECT ON DATABASE '+otherDb+' FROM PUBLIC');
   await operator.query("INSERT INTO tenant_registry(tenant_id,database_name,role_name,state) VALUES($1,$2,$3,'active') ON CONFLICT DO NOTHING",[other,otherDb,otherRole]);
   assert(!(await operator.query('SELECT 1 FROM tenant_memberships WHERE tenant_id=$1 AND principal_id=$2',[other,bootstrap.founder])).rowCount);
  }finally{await operator.end()}
  const negativeDb=new pg.Pool({host:'control-postgres',user:'postgres',password:await file('pg-admin'),database:otherDb,max:1});
  const foreignPerson='33333333-3333-4333-8333-333333333333';
  try{
   await negativeDb.query('CREATE TABLE IF NOT EXISTS stage_private_person(id uuid PRIMARY KEY,name text NOT NULL)');
   await negativeDb.query("INSERT INTO stage_private_person VALUES($1,'Other tenant synthetic sentinel') ON CONFLICT DO NOTHING",[foreignPerson]);
  }finally{await negativeDb.end()}
  phase='http-matrix';
  const readTuples=[[A,A1],[A,A2],[B,B1],[B,B2]].map(([org,ws])=>({user:'user:'+bootstrap.founder,relation:'grantee',object:iam07dFineObjectForScope({tenantId:tid,organizationId:org,workspaceId:ws,capability:'inbox.conversation.read',resourceName:'syndes:v1:tenant:'+tid+':org:'+org+':workspace:'+ws})}));
  const readGrant=await fetch('http://openfga:8080/stores/'+bootstrap.store+'/write',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({writes:{tuple_keys:readTuples}}),signal:AbortSignal.timeout(5000)});assert(readGrant.ok);

  await api('inbox/conversations',{statuses:[401]});
  await api('inbox/conversations',{token:'invalid',statuses:[401]});
  await api('inbox/conversations',{token:tokenB,org:A,ws:A1,statuses:[403]});
  await api('inbox/conversations',{token:tokenA,org:B,ws:A1,statuses:[403]});
  await api('inbox/conversations',{token:tokenA,tenant:'22222222-2222-4222-8222-222222222222',statuses:[403]});
  await api('crm/people/'+foreignPerson,{token:tokenA,tenant:other,statuses:[403]});
  console.log('STAGE_ACCEPTANCE_TWO_DATABASE_TENANTS_SECOND_UNENTITLED_DENY_PASS');
  // Same signed founder subject may read all four workspaces. Membership
  // alone never supplies a fine write grant in A2/B2.
  for(const [org,ws] of [[A,A1],[A,A2],[B,B1],[B,B2]])await api('inbox/conversations',{token:tokenA,org,ws});
  for(const [org,ws] of [[A,A2],[B,B2]])await api('inbox/conversations',{token:tokenA,org,ws,method:'POST',body:{subject:'MUST DENY WITHOUT EXPLICIT GRANT'},statuses:[403]});
  await api('inbox/conversations',{token:tokenB,org:B,ws:A2,statuses:[403]});
  console.log('STAGE_ACCEPTANCE_SAME_SUBJECT_TWO_ORGS_FOUR_WORKSPACES_MEMBERSHIP_WITHOUT_FINE_GRANT_DENY_PASS');
  const pa=(await api('crm/people',{token:tokenA,method:'POST',body:{name:'Stage Alpha '+randomUUID()},statuses:[201]})).data;
  const pb=(await api('crm/people',{token:tokenB,org:B,ws:B1,method:'POST',body:{name:'Stage Beta '+randomUUID()},statuses:[201]})).data;
  assert(pa.id&&pb.id);
  await api('crm/people/'+pb.id,{token:tokenA,statuses:[404]});
  const csv=await api('crm/exports/csv?kind=people',{token:tokenA});
  assert(!csv.text.includes(pb.name));
  const sa=await stream(tokenA,A,A1),sb=await stream(tokenB,B,B1);
  const beforeB=sb.events;
  const ca=(await api('inbox/conversations',{token:tokenA,method:'POST',body:{subject:'Stage A '+randomUUID()},statuses:[201]})).data;
  const cb=(await api('inbox/conversations',{token:tokenB,org:B,ws:B1,method:'POST',body:{subject:'Stage B '+randomUUID()},statuses:[201]})).data;
  assert(ca.id&&cb.id);
  await api('inbox/conversations/'+ca.id+'/claim',{token:tokenA,method:'POST',statuses:[201]});
  await api('inbox/conversations/'+ca.id+'/notes',{token:tokenA,method:'POST',body:{body:'Stage note'},statuses:[201]});
  await api('inbox/conversations/'+cb.id,{token:tokenA,statuses:[404]});
  await api('inbox/conversations/'+ca.id,{token:tokenB,org:B,ws:B1,statuses:[404]});
  await api('inbox/conversations/'+ca.id+'/history',{token:tokenA,method:'POST',statuses:[403]});
  // Wait for prior B mutation, then prove a new A write never notifies B.
  await sleep(800);const bCount=sb.events,aCount=sa.events;
  await api('inbox/conversations/'+ca.id+'/notes',{token:tokenA,method:'POST',body:{body:'Scoped SSE A'},statuses:[201]});
  await eventually(()=>Promise.resolve(sa.events>aCount));await sleep(700);assert(sb.events===bCount&&bCount>=beforeB);
  console.log('STAGE_ACCEPTANCE_REAL_HTTP_CRM_INBOX_KNOWN_IDS_CSV_SCOPE_SSE_PASS');
  phase='service-http';
  const funnels=(await api('service-management/funnels',{token:tokenA})).data;
  assert(Array.isArray(funnels)&&funnels.length===2);
  const funnel=funnels[0];
  const attendance=(await api('service-management/attendances',{token:tokenA,method:'POST',body:{funnelId:funnel.id,idempotencyKey:'stage-'+randomUUID()},statuses:[201]})).data;
  assert(attendance.id);
  await api('service-management/attendances/'+attendance.id,{token:tokenB,org:B,ws:B1,statuses:[404]});
  const stages=(await db.query('SELECT id FROM service.service_funnel_stages WHERE tenant_id=$1 AND organization_id=$2 AND workspace_id=$3 AND funnel_id=$4 ORDER BY position',[tid,A,A1,funnel.id])).rows;
  assert(stages.length===2);
  await api('service-management/attendances/'+attendance.id+'/stage',{token:tokenA,method:'PATCH',body:{nextStageId:stages[1].id,expectedVersion:attendance.version},statuses:[200]});
  console.log('STAGE_ACCEPTANCE_REAL_SERVICE_OPEN_STAGE_CROSS_ORG_DENY_PASS');
  phase='revocation';
  const cap='inbox.message.note';const resourceName='syndes:v1:tenant:'+tid+':org:'+A+':workspace:'+A1;
  const object=iam07dFineObjectForScope({tenantId:tid,organizationId:A,workspaceId:A1,capability:cap,resourceName});
  const tuple={user:'user:'+bootstrap.founder,relation:'grantee',object};
  const fga=async body=>{const r=await fetch('http://openfga:8080/stores/'+bootstrap.store+'/write',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});assert(r.ok)};
  const count=async()=>Number((await db.query('SELECT count(*) n FROM inbox_messages WHERE tenant_id=$1 AND conversation_id=$2',[tid,ca.id])).rows[0].n);
  const before=await count();await fga({deletes:{tuple_keys:[tuple]}});
  try{await api('inbox/conversations/'+ca.id+'/notes',{token:tokenA,method:'POST',body:{body:'MUST NOT COMMIT'},statuses:[403]});assert(await count()===before)}
  finally{await fga({writes:{tuple_keys:[tuple]}})}
  const orgLink=(await control.query('SELECT keycloak_organization_id AS id FROM platform_keycloak_org_links WHERE tenant_id=$1 AND organization_id=$2',[tid,B])).rows[0].id;
  const memberUrl=KC+'/admin/realms/syndes-pilot/organizations/'+orgLink+'/members';
  const deleted=await fetch(memberUrl+'/'+bootstrap.restricted,{method:'DELETE',headers:{Authorization:'Bearer '+admin},signal:AbortSignal.timeout(8000)});assert(deleted.ok);
  try{
   await api('inbox/conversations',{token:tokenB,org:B,ws:B1,statuses:[403]});
   await eventually(()=>Promise.resolve(sb.closed),12000);
  }finally{
   const r=await fetch(memberUrl,{method:'POST',headers:{Authorization:'Bearer '+admin,'Content-Type':'application/json'},body:JSON.stringify(bootstrap.restricted),signal:AbortSignal.timeout(8000)});assert(r.ok);
  }
  const reconnected=await stream(tokenB,B,B1);assert(!reconnected.closed);reconnected.stop();
  await db.query("UPDATE platform_iam_capability_fences SET epoch=epoch+1,state='revoked',last_revoke_operation_id=$6 WHERE tenant_id=$1 AND organization_id=$2 AND workspace_id=$3 AND principal_id=$4 AND capability=$5",[tid,A,A1,bootstrap.founder,cap,randomUUID()]);
  try{await api('inbox/conversations/'+ca.id+'/notes',{token:tokenA,method:'POST',body:{body:'FENCE MUST DENY'},statuses:[403]});assert(await count()===before)}
  finally{await db.query("UPDATE platform_iam_capability_fences SET epoch=epoch+1,state='active',last_revoke_operation_id=NULL WHERE tenant_id=$1 AND organization_id=$2 AND workspace_id=$3 AND principal_id=$4 AND capability=$5",[tid,A,A1,bootstrap.founder,cap])}
  phase='concurrent-revoke-first-http';
  const lock=await db.connect();let pending;
  try{
   await lock.query('BEGIN');
   const locked=await lock.query('SELECT 1 FROM platform_iam_capability_fences WHERE tenant_id=$1 AND organization_id=$2 AND workspace_id=$3 AND principal_id=$4 AND capability=$5 FOR UPDATE',[tid,A,A1,bootstrap.founder,cap]);assert(locked.rowCount===1);
   pending=api('inbox/conversations/'+ca.id+'/notes',{token:tokenA,method:'POST',body:{body:'CONCURRENT REVOKE MUST DENY'},statuses:[403]}).then(value=>({value}),error=>({error}));
   // Observe the actual HTTP transaction waiting on the owner-held epoch row;
   // timing alone is never accepted as proof of concurrent serialization.
   await eventually(async()=>Number((await db.query("SELECT count(*) n FROM pg_stat_activity WHERE datname=current_database() AND usename=$1 AND wait_event_type='Lock' AND query LIKE '%platform_iam_capability_fences%'",['syndes_t_'+tid.replaceAll('-','')])).rows[0].n)>0,8000);
   await lock.query("UPDATE platform_iam_capability_fences SET epoch=epoch+1,state='revoked',last_revoke_operation_id=$6 WHERE tenant_id=$1 AND organization_id=$2 AND workspace_id=$3 AND principal_id=$4 AND capability=$5",[tid,A,A1,bootstrap.founder,cap,randomUUID()]);
   await lock.query('COMMIT');
   const outcome=await pending;if(outcome.error)throw outcome.error;assert(await count()===before);
  }finally{
   await lock.query('ROLLBACK');lock.release();
   if(pending)await pending;
   await db.query("UPDATE platform_iam_capability_fences SET epoch=epoch+1,state='active',last_revoke_operation_id=NULL WHERE tenant_id=$1 AND organization_id=$2 AND workspace_id=$3 AND principal_id=$4 AND capability=$5",[tid,A,A1,bootstrap.founder,cap]);
  }
  console.log('STAGE_ACCEPTANCE_REAL_HTTP_WAITING_TRANSACTION_REVOKE_FIRST_ZERO_WRITE_PASS');
  console.log('STAGE_ACCEPTANCE_FGA_KEYCLOAK_FENCE_REVOKE_SQL_NO_WRITE_SSE_CLOSE_RECONNECT_PASS');
  phase='whatsapp-worker';
  const accounts=[randomUUID(),randomUUID()];
  for(const [i,org] of [A,B].entries())await db.query('INSERT INTO whatsapp_accounts(id,tenant_id,display_name,platform_organization_id) VALUES($1,$2,$3,$4)',[accounts[i],tid,'Synthetic stage '+i,org]);
  const incoming=new WhatsAppInboundStore(provider);
  const envelopes=accounts.map((accountId,i)=>({version:'1',type:'whatsapp.message.received',tenantId:tid,accountId,message:{accountId,externalMessageId:'stage-'+randomUUID(),senderExternalId:'stage-'+i+'@lid',body:'Synthetic worker '+i,occurredAt:new Date().toISOString()}}));
  for(const e of envelopes)assert((await incoming.persist(tid,e)).accepted===true);
  assert((await incoming.persist(tid,envelopes[0])).accepted===true); // transport replay is accepted, never duplicates business effect
  await eventually(async()=>Number((await db.query("SELECT count(*) n FROM whatsapp_inbound_events WHERE tenant_id=$1 AND account_id=ANY($2::uuid[]) AND processed_at IS NOT NULL",[tid,accounts])).rows[0].n)===2,20000);
  const routes=(await db.query('SELECT c.id,c.platform_organization_id AS org,c.platform_current_workspace_id AS ws FROM whatsapp_conversation_routes r JOIN inbox_conversations c ON c.tenant_id=r.tenant_id AND c.id=r.conversation_id WHERE r.tenant_id=$1 AND r.account_id=ANY($2::uuid[])',[tid,accounts])).rows;
  assert(routes.length===2&&routes.some(x=>x.org===A&&x.ws===A1)&&routes.some(x=>x.org===B&&x.ws===B1));
  await api('inbox/conversations/'+routes.find(x=>x.org===B).id,{token:tokenA,statuses:[404]});
  await db.query("UPDATE platform_organizations SET status='archived' WHERE tenant_id=$1 AND id=$2",[tid,B]);
  try{
   const e={...envelopes[1],message:{...envelopes[1].message,externalMessageId:'archive-'+randomUUID()}};
   let denied=false;try{await incoming.persist(tid,e)}catch(error){denied=error?.getStatus?.()===404}assert(denied);
   const outboundId=randomUUID();
   await db.query("INSERT INTO whatsapp_outbox(id,tenant_id,account_id,idempotency_key,recipient_external_id,body) VALUES($1,$2,$3,$4,'stage@lid','Synthetic denied outbound')",[outboundId,tid,accounts[1],randomUUID()]);
   let effects=0;const relay=new WhatsAppOutboundRelay(provider,{sendQueued:async()=>{effects++;throw Error('No real provider permitted')},outboundStatus:async()=>{effects++;throw Error('No real provider permitted')}});
   assert(await relay.deliverNext(tid)==='empty'&&effects===0);
   await db.query("UPDATE whatsapp_outbox SET status='failed' WHERE id=$1",[outboundId]);
  }finally{await db.query("UPDATE platform_organizations SET status='active' WHERE tenant_id=$1 AND id=$2",[tid,B])}
  console.log('STAGE_ACCEPTANCE_REAL_RUNNING_WHATSAPP_WORKER_DEDUP_SCOPE_ARCHIVE_NO_EXTERNAL_EFFECT_PASS');
  // Persist only an opaque verification report, not JWTs or personal data.
  await writeFile('/run/runtime/acceptance.json',JSON.stringify({sourceSha:process.env.SOURCE_SHA,passed:true,synthetic:true,at:new Date().toISOString()}),{mode:0o644});
  console.log('STAGE_CORE_REAL_HTTP_IDP_FGA_SQL_WORKER_SSE_ACCEPTANCE_PASS');
 }finally{for(const fn of cleanup.reverse())await fn();await provider.onModuleDestroy();await db.end();await control.end()}
}
main().catch(()=>{console.error('STAGE_ACCEPTANCE_BLOCKED='+phase);process.exitCode=1});
