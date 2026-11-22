// Real stage HTTP/SQL/IdP/FGA/worker/SSE acceptance, synthetic data only.
import {readFile,writeFile} from 'node:fs/promises';
import {lookup} from 'node:dns/promises';
import {randomUUID,createHash} from 'node:crypto';
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
 for(let attempt=1;attempt<=20;attempt++){
  let r;
  try{r=await fetch(KC+'/realms/'+(username?'syndes-pilot':'master')+'/protocol/openid-connect/token',{
   method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body),redirect:'error',signal:AbortSignal.timeout(8000)});
  }catch(error){if(attempt===20)throw error;await sleep(2000);continue}
  if(r.status===200)return (await r.json()).access_token;
  console.error('STAGE_IDP_TOKEN_STATUS='+r.status+' attempt='+attempt);
  if(![404,502,503,504].includes(r.status)||attempt===20)throw Error('Stage IdP token unavailable');
  await sleep(2000);
 }
 throw Error('Stage IdP token unavailable');
}
async function api(path,{token,org=A,ws=A1,method='GET',body,statuses=[200],tenant=tid}={}){
 const headers={'Content-Type':'application/json','x-syndes-organization-id':org,'x-syndes-workspace-id':ws};
 if(token)headers.Authorization='Bearer '+token;
 let r;try{r=await fetch(BASE+'/v1/tenants/'+tenant+'/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(14000)});}catch(error){phase+='_'+method+'_'+path.replace(/[^a-zA-Z0-9:_/-]/g,'_')+'_FETCH';console.error('STAGE_HTTP_FETCH_ERROR='+String(error));throw error;}
 if(!statuses.includes(r.status)){console.error('STAGE_HTTP_MISMATCH path='+path+' org='+org+' ws='+ws+' status='+r.status+' expected='+statuses.join(','));phase+='_'+method+'_'+path.replace(/[a-f0-9-]{36}/gi,':id').replace(/[^a-zA-Z0-9:_/-]/g,'_')+'_'+r.status;throw Error('HTTP result')}const text=await r.text();let data;
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
 const restoredRealmDb=new pg.Pool({host:'control-postgres',user:'postgres',password:await file('pg-admin'),database:'syndes_staging_keycloak',max:1});
 try{
  const realms=(await restoredRealmDb.query("SELECT count(*) FILTER (WHERE name='master')::int AS master,count(*) FILTER (WHERE name='syndes-pilot')::int AS pilot FROM realm")).rows[0];
  const endpoint=await Promise.all(['master','syndes-pilot'].map(async realm=>{try{return (await fetch(KC+'/realms/'+realm,{signal:AbortSignal.timeout(5000)})).status}catch{return 0}}));
  const direct=await Promise.all(['master','syndes-pilot'].map(async realm=>{try{return (await fetch('http://keycloak:8080/realms/'+realm,{signal:AbortSignal.timeout(5000)})).status}catch{return 0}}));
  const forwarded=await Promise.all(['master','syndes-pilot'].map(async realm=>{try{return (await fetch('http://keycloak:8080/realms/'+realm,{headers:{Host:'identity-stage:8443','X-Forwarded-Host':'identity-stage:8443','X-Forwarded-Proto':'https','X-Forwarded-Port':'8443'},signal:AbortSignal.timeout(5000)})).status}catch{return 0}}));
  const proxyResponse=await fetch(KC+'/realms/master',{signal:AbortSignal.timeout(5000)});
  const proxyBody=(await proxyResponse.text()).slice(0,180).replace(/[^a-zA-Z0-9 /:._-]/g,'_');
  const fgaResponse=await fetch('http://openfga:8080/realms/master',{signal:AbortSignal.timeout(5000)});
  const fgaBody=(await fgaResponse.text()).slice(0,180).replace(/[^a-zA-Z0-9 /:._-]/g,'_');
  console.error('STAGE_PROXY_ORIGIN_COMPARE fga_status='+fgaResponse.status+' fga_body='+fgaBody);
  console.error('STAGE_PROXY_DNS identity='+JSON.stringify(await lookup('identity-stage',{all:true}))+' keycloak='+JSON.stringify(await lookup('keycloak',{all:true}))+' proxy_content_type='+proxyResponse.headers.get('content-type'));
  console.error('STAGE_RESTORED_IDP_DIAG master_db='+realms.master+' pilot_db='+realms.pilot+' master_http='+endpoint[0]+' pilot_http='+endpoint[1]+' master_direct='+direct[0]+' pilot_direct='+direct[1]+' master_forwarded='+forwarded[0]+' pilot_forwarded='+forwarded[1]+' proxy_body='+proxyBody);
 }finally{await restoredRealmDb.end()}
 const bootstrap=JSON.parse(await file('core-pilot-bootstrap.json'));
 const admin=await oauth('syndes-stage-pilot-recovery',await file('pilot-admin-service-secret'));
 const tokenA=await oauth('syndes-pilot-staging-login',await file('pilot-founder-password'),'pilot-founder');
 const tokenB=await oauth('syndes-pilot-staging-login',await file('pilot-b-only-password'),'pilot-b-only');
 const claims=JSON.parse(Buffer.from(tokenA.split('.')[1],'base64url'));const actorId=claims.sub;assert(actorId===bootstrap.founder);
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
  const readScopes=[[A,A1],[A,A2],[B,B1],[B,B2]];
  const readTuples=readScopes.flatMap(([org,ws])=>['inbox.conversation.claim'].map(capability=>({user:'user:'+actorId,relation:'grantee',object:iam07dFineObjectForScope({tenantId:tid,organizationId:org,workspaceId:ws,capability,resourceName:'syndes:v1:tenant:'+tid+':org:'+org+':workspace:'+ws})})));
  readTuples.push(...[[A,A1],[B,B1]].map(([org,ws])=>({user:'user:'+actorId,relation:'grantee',object:iam07dFineObjectForScope({tenantId:tid,organizationId:org,workspaceId:ws,capability:'inbox.conversation.create',resourceName:'syndes:v1:tenant:'+tid+':org:'+org+':workspace:'+ws})})));
  const readGrant=await fetch('http://openfga:8080/stores/'+bootstrap.store+'/write',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({writes:{tuple_keys:readTuples}}),signal:AbortSignal.timeout(5000)});if(!readGrant.ok&&readGrant.status!==400)throw Error('Inbox grant seed failed '+readGrant.status);
  const coarseObject=resource=> 'resource:'+createHash('sha256').update(tid+'|'+resource).digest('hex');
  const coarseTuples=[{user:'user:'+actorId,relation:'viewer',object:coarseObject('inbox:conversations')},{user:'user:'+actorId,relation:'editor',object:coarseObject('inbox:messages')}];
  const coarseGrant=await fetch('http://openfga:8080/stores/'+bootstrap.store+'/write',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({writes:{tuple_keys:coarseTuples}}),signal:AbortSignal.timeout(5000)});if(!coarseGrant.ok&&coarseGrant.status!==400)throw Error('Coarse grant seed failed '+coarseGrant.status);
  const coarseCheck=await fetch('http://openfga:8080/stores/'+bootstrap.store+'/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tuple_key:{user:'user:'+actorId,relation:'can_read',object:coarseObject('inbox:conversations')}}),signal:AbortSignal.timeout(5000)});const coarseJson=await coarseCheck.json();if(coarseJson.allowed!==true)throw Error('Coarse grant denied '+JSON.stringify(coarseJson));

  await api('inbox/conversations',{statuses:[401]});
  await api('inbox/conversations',{token:'invalid',statuses:[401]});
  await api('inbox/conversations',{token:tokenB,org:A,ws:A1,statuses:[403]});
  await api('inbox/conversations',{token:tokenA,org:B,ws:A1,statuses:[403]});
  await api('inbox/conversations',{token:tokenA,tenant:'22222222-2222-4222-8222-222222222222',statuses:[403]});
  await api('crm/people/'+foreignPerson,{token:tokenA,tenant:other,statuses:[403]});
  console.log('STAGE_ACCEPTANCE_TWO_DATABASE_TENANTS_SECOND_UNENTITLED_DENY_PASS');
  phase='inbox-admission-diagnostic';
  const gateRows=(await control.query("SELECT e.module_id,e.state AS entitlement,i.state AS install,i.target_version,i.installed_version,(i.verification_digest IS NOT NULL AND i.verified_at IS NOT NULL) AS verified FROM tenant_module_entitlements e LEFT JOIN tenant_module_installs i ON i.tenant_id=e.tenant_id AND i.module_id=e.module_id WHERE e.tenant_id=$1 AND e.module_id='inbox'",[tid])).rows;
  const scopeRows=(await db.query("SELECT o.status AS org_status,w.status AS ws_status,om.state AS org_member,wm.state AS ws_member FROM platform_organizations o JOIN platform_workspaces w ON w.tenant_id=o.tenant_id AND w.organization_id=o.id JOIN platform_org_memberships om ON om.tenant_id=o.tenant_id AND om.organization_id=o.id AND om.principal_id=$2 JOIN platform_workspace_memberships wm ON wm.tenant_id=o.tenant_id AND wm.organization_id=o.id AND wm.workspace_id=w.id AND wm.principal_id=$2 WHERE o.tenant_id=$1 AND o.id=$3 AND w.id=$4",[tid,actorId,A,A1])).rows;
  console.error('STAGE_INBOX_ADMISSION_DIAG control_count='+gateRows.length+' entitlement='+(gateRows[0]?.entitlement??'missing')+' install='+(gateRows[0]?.install??'missing')+' versions_match='+(gateRows[0]?.target_version===gateRows[0]?.installed_version)+' verified='+(gateRows[0]?.verified===true)+' scope_count='+scopeRows.length+' org_active='+(scopeRows[0]?.org_status==='active')+' ws_active='+(scopeRows[0]?.ws_status==='active')+' org_member_active='+(scopeRows[0]?.org_member==='active')+' ws_member_active='+(scopeRows[0]?.ws_member==='active'));
  const scopePrerequisites=(await db.query("SELECT (SELECT count(*)::int FROM platform_legacy_backfill_runs a JOIN platform_organizations o ON o.tenant_id=a.tenant_id AND o.id=a.organization_id WHERE a.tenant_id=$1 AND o.is_default) AS default_backfill,(SELECT count(*)::int FROM pg_indexes WHERE schemaname=current_schema() AND indexname IN ('platform_legacy_single_organization','platform_legacy_single_workspace')) AS sql002_indexes",[tid])).rows[0];
  console.error('STAGE_SCOPE_PREREQUISITES_DIAG default_backfill='+scopePrerequisites.default_backfill+' sql002_indexes='+scopePrerequisites.sql002_indexes);
  phase='greenfield-default-ownership-audit';
  const audit=await db.connect();
  try{
   await audit.query('BEGIN');
   const defaultScope=(await audit.query("SELECT o.id AS org,w.id AS ws FROM platform_organizations o JOIN platform_workspaces w ON w.tenant_id=o.tenant_id AND w.organization_id=o.id WHERE o.tenant_id=$1 AND o.is_default AND w.is_default AND o.status='active' AND w.status='active' FOR SHARE OF o,w",[tid])).rows;
   assert(defaultScope.length===1&&defaultScope[0].org===A&&defaultScope[0].ws===A1);
   const existing=(await audit.query('SELECT count(*)::int n FROM platform_legacy_backfill_runs WHERE tenant_id=$1 AND organization_id=$2',[tid,A])).rows[0].n;
   if(existing===0){
    const owners=(await audit.query("SELECT (SELECT count(*)::int FROM crm_people)+(SELECT count(*)::int FROM crm_organizations)+(SELECT count(*)::int FROM crm_tags)+(SELECT count(*)::int FROM inbox_conversations)+(SELECT count(*)::int FROM whatsapp_accounts) AS n")).rows[0];
    assert(owners.n===0); // Greenfield only: never attest historical data without a real backfill.
    const indexes=(await audit.query("SELECT count(*)::int n FROM pg_indexes WHERE schemaname=current_schema() AND indexname IN ('platform_legacy_single_organization','platform_legacy_single_workspace')")).rows[0];
    assert(indexes.n===0); // This fixture was created after the scoped cutover.
    await audit.query("INSERT INTO platform_legacy_backfill_runs(tenant_id,organization_id,actor_id,counts) VALUES($1,$2,'system:stage-greenfield-actions',$3::jsonb)",[tid,A,JSON.stringify({crm_people:0,crm_organizations:0,crm_tags:0,inbox_conversations:0,whatsapp_accounts:0})]);
   }
   await audit.query('COMMIT');
  }catch(error){await audit.query('ROLLBACK');throw error}finally{audit.release()}
  console.error('STAGE_GREENFIELD_DEFAULT_OWNERSHIP_AUDIT_PASS');
  phase='http-matrix';
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
  const tuple={user:'user:'+actorId,relation:'grantee',object};
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
  await db.query("UPDATE platform_iam_capability_fences SET epoch=epoch+1,state='revoked',last_revoke_operation_id=$6 WHERE tenant_id=$1 AND organization_id=$2 AND workspace_id=$3 AND principal_id=$4 AND capability=$5",[tid,A,A1,actorId,cap,randomUUID()]);
  try{await api('inbox/conversations/'+ca.id+'/notes',{token:tokenA,method:'POST',body:{body:'FENCE MUST DENY'},statuses:[403]});assert(await count()===before)}
  finally{await db.query("UPDATE platform_iam_capability_fences SET epoch=epoch+1,state='active',last_revoke_operation_id=NULL WHERE tenant_id=$1 AND organization_id=$2 AND workspace_id=$3 AND principal_id=$4 AND capability=$5",[tid,A,A1,actorId,cap])}
  phase='concurrent-revoke-first-http';
  const lock=await db.connect();let pending;
  try{
   await lock.query('BEGIN');
   const locked=await lock.query('SELECT 1 FROM platform_iam_capability_fences WHERE tenant_id=$1 AND organization_id=$2 AND workspace_id=$3 AND principal_id=$4 AND capability=$5 FOR UPDATE',[tid,A,A1,actorId,cap]);assert(locked.rowCount===1);
   pending=api('inbox/conversations/'+ca.id+'/notes',{token:tokenA,method:'POST',body:{body:'CONCURRENT REVOKE MUST DENY'},statuses:[403]}).then(value=>({value}),error=>({error}));
   // Observe the actual HTTP transaction waiting on the owner-held epoch row;
   // timing alone is never accepted as proof of concurrent serialization.
   await eventually(async()=>Number((await db.query("SELECT count(*) n FROM pg_stat_activity WHERE datname=current_database() AND usename=$1 AND wait_event_type='Lock' AND query LIKE '%platform_iam_capability_fences%'",['syndes_t_'+tid.replaceAll('-','')])).rows[0].n)>0,8000);
   await lock.query("UPDATE platform_iam_capability_fences SET epoch=epoch+1,state='revoked',last_revoke_operation_id=$6 WHERE tenant_id=$1 AND organization_id=$2 AND workspace_id=$3 AND principal_id=$4 AND capability=$5",[tid,A,A1,actorId,cap,randomUUID()]);
   await lock.query('COMMIT');
   const outcome=await pending;if(outcome.error)throw outcome.error;assert(await count()===before);
  }finally{
   await lock.query('ROLLBACK');lock.release();
   if(pending)await pending;
   await db.query("UPDATE platform_iam_capability_fences SET epoch=epoch+1,state='active',last_revoke_operation_id=NULL WHERE tenant_id=$1 AND organization_id=$2 AND workspace_id=$3 AND principal_id=$4 AND capability=$5",[tid,A,A1,actorId,cap]);
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
main().catch(error=>{console.error('STAGE_ACCEPTANCE_ERROR='+String(error?.stack||error));console.error('STAGE_ACCEPTANCE_BLOCKED='+phase);process.exitCode=1});
