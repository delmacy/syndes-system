// Trusted Actions operator for the isolated stage only; never imported by Core.
import {readFile,writeFile,chmod} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import pg from '/workspace/apps/core-host/node_modules/pg/lib/index.js';
const ROOT='/run/stage/';
const KC='https://identity-stage:8443';
const BAO='https://openbao-stage:8200/v1/';
const realm='syndes-pilot';
let phase='safety';
const check=(v)=>{if(!v)throw Error('Stage precondition failed')};
async function file(name){return (await readFile(ROOT+name,'utf8')).trim()}
async function secret(name){
 try{const s=await file(name);check(/^[a-f0-9]{64}$/.test(s));return s}
 catch(e){if(e.code!=='ENOENT')throw e;
  const s=randomBytes(32).toString('hex');await writeFile(ROOT+name,s+'\n',{flag:'wx',mode:0o600});return s;}
}
async function request(url,{method='GET',body,token,statuses=[200]}={}){
 const headers={'Content-Type':'application/json'};
 if(token)headers[url.startsWith(BAO)?'X-Vault-Token':'Authorization']=url.startsWith(BAO)?token:'Bearer '+token;
 const r=await fetch(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),
  redirect:'error',signal:AbortSignal.timeout(12000)});
 check(statuses.includes(r.status));
 const text=await r.text();return {status:r.status,json:text?JSON.parse(text):null};
}
async function token(client,clientSecret,whichRealm=realm){
 const r=await fetch(KC+'/realms/'+whichRealm+'/protocol/openid-connect/token',{
  method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({grant_type:'client_credentials',client_id:client,client_secret:clientSecret}),
  redirect:'error',signal:AbortSignal.timeout(10000)});
 check(r.status===200);const j=await r.json();check(typeof j.access_token==='string');return j.access_token;
}
async function main(){
 check(process.env.SYNDES_STAGE_SETUP==='ACTIONS_ISOLATED_STAGE_ONLY');
 check(/^[a-f0-9]{40}$/.test(process.env.SOURCE_SHA||''));
 phase='https-issuer';
 let oidc;
 for(let n=0;n<40;n++){
  try{oidc=(await request(KC+'/realms/'+realm+'/.well-known/openid-configuration')).json;break}
  catch{if(n===39)throw Error('timeout');await new Promise(r=>setTimeout(r,3000))}
 }
 check(oidc.issuer===KC+'/realms/'+realm);
 check((await request(oidc.jwks_uri)).json.keys.length>0);
 console.log('STAGE_RUNTIME_KEYCLOAK_HTTPS_ISSUER_JWKS_PASS');
 phase='keycloak-reader';
 const admin=await token('syndes-stage-pilot-recovery',await file('pilot-admin-service-secret'),'master');
 const prefix=KC+'/admin/realms/'+realm;
 const call=(path,opts={})=>request(prefix+path,{...opts,token:admin});
 const readerName='syndes-stage-org-reader';
 const readerSecret=await secret('org-reader-secret');
 let clients=(await call('/clients?clientId='+readerName)).json;
 if(clients.length===0){
  await call('/clients',{method:'POST',statuses:[201,204],body:{clientId:readerName,
   secret:readerSecret,enabled:true,protocol:'openid-connect',publicClient:false,
   serviceAccountsEnabled:true,standardFlowEnabled:false,directAccessGrantsEnabled:false,
   implicitFlowEnabled:false,fullScopeAllowed:false}});
  clients=(await call('/clients?clientId='+readerName)).json;
 }
 check(clients.length===1);const reader=clients[0];
 check(reader.publicClient===false&&reader.serviceAccountsEnabled===true&&reader.fullScopeAllowed===false);
 check(reader.standardFlowEnabled===false&&reader.directAccessGrantsEnabled===false);
 const management=(await call('/clients?clientId=realm-management')).json;
 check(management.length===1);
 const managementId=management[0].id;
 const service=(await call('/clients/'+reader.id+'/service-account-user')).json;
 const roles=[];
 for(const name of ['view-users','view-organizations'])roles.push((await call('/clients/'+managementId+'/roles/'+name)).json);
 for(const path of ['/users/'+service.id+'/role-mappings/clients/'+managementId,
  '/clients/'+reader.id+'/scope-mappings/clients/'+managementId]){
  const existing=(await call(path)).json;
  check(existing.every(x=>roles.some(r=>r.id===x.id)));
  const missing=roles.filter(x=>!existing.some(r=>r.id===x.id));
  if(missing.length)await call(path,{method:'POST',body:missing,statuses:[204]});
 }
 const rt=await token(readerName,readerSecret);
 const orgs=(await request(prefix+'/organizations?first=0&max=100',{token:rt})).json;
 check(orgs.length===2);
 // Reader cannot create even an invalid Organization. Authorization precedes input.
 await request(prefix+'/organizations',{token:rt,method:'POST',body:{},statuses:[403]});
 console.log('STAGE_RUNTIME_RESTRICTED_KEYCLOAK_READER_READ_ALLOW_WRITE_DENY_PASS');
 phase='sql-core-role';
 const adminDb=new pg.Pool({host:'control-postgres',port:5432,user:'postgres',
  password:await file('pg-admin'),database:'syndes_staging_control',max:1});
 const corePassword=await secret('core-db-password');
 try{
  const ver=(await adminDb.query("SHOW server_version_num")).rows[0].server_version_num;
  check(Number(ver)>=170000&&Number(ver)<180000);
  check((await adminDb.query("SELECT count(*)::int AS n FROM tenant_registry WHERE tenant_id='1f5a8ce9-3f01-48cc-a013-2198d99e7510' AND state='active'")).rows[0].n===1);
  const old=await adminDb.query("SELECT * FROM pg_roles WHERE rolname='syndes_staging_core'");
  if(!old.rowCount){
   await adminDb.query("CREATE ROLE syndes_staging_core LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '"+corePassword+"'");
   await adminDb.query('GRANT syndes_core TO syndes_staging_core');
   await adminDb.query('GRANT CONNECT ON DATABASE syndes_staging_control TO syndes_staging_core');
  }
  for(const [db,login] of [['syndes_staging_keycloak','syndes_staging_keycloak'],['syndes_staging_openfga','syndes_staging_openfga'],['syndes_staging_control','syndes_staging_core']]){
   await adminDb.query('REVOKE CONNECT ON DATABASE '+db+' FROM PUBLIC');
   await adminDb.query('GRANT CONNECT ON DATABASE '+db+' TO '+login);
  }
  const role=(await adminDb.query("SELECT * FROM pg_roles WHERE rolname='syndes_staging_core'")).rows[0];
  check(role.rolcanlogin&&!role.rolsuper&&!role.rolcreatedb&&!role.rolcreaterole&&!role.rolreplication&&!role.rolbypassrls);
  const memberships=(await adminDb.query("SELECT r.rolname FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles u ON u.oid=m.member WHERE u.rolname='syndes_staging_core'")).rows;
  check(memberships.length===1&&memberships[0].rolname==='syndes_core');
 }finally{await adminDb.end()}
 const coreDb=new pg.Pool({host:'control-postgres',user:'syndes_staging_core',password:corePassword,
  database:'syndes_staging_control',max:1});
 try{
  await coreDb.query('SELECT 1 FROM public.tenant_registry LIMIT 0');
  const access=(await coreDb.query("SELECT has_table_privilege(current_user,'public.tenant_registry','UPDATE') AS write,has_database_privilege(current_user,'syndes_staging_keycloak','CONNECT') AS kc")).rows[0];
  check(access.write===false&&access.kc===false);
 }finally{await coreDb.end()}
 console.log('STAGE_RUNTIME_CORE_SQL_LOGIN_LEAST_PRIVILEGE_PASS');
 phase='openbao-init';
 const health=(await request(BAO+'sys/health',{statuses:[200,501,503]})).json;
 let init;
 try{init=JSON.parse(await file('bao-stage-recovery.json'))}catch(e){if(e.code!=='ENOENT')throw e;}
 if(!health.initialized){
  check(!init);
  init=(await request(BAO+'sys/init',{method:'PUT',body:{secret_shares:1,secret_threshold:1}})).json;
  check(init.root_token&&init.keys_base64?.length===1);
  await writeFile(ROOT+'bao-stage-recovery.json',JSON.stringify(init),{flag:'wx',mode:0o600});
 }
 check(init?.root_token&&init.keys_base64?.length===1);
 if(health.sealed)await request(BAO+'sys/unseal',{method:'PUT',body:{key:init.keys_base64[0]}});
 const root=init.root_token;
 const bao=(path,opts={})=>request(BAO+path,{...opts,token:root});
 const mounts=(await bao('sys/mounts')).json;
 if(!mounts['kv/'])await bao('sys/mounts/kv',{method:'POST',body:{type:'kv',options:{version:'2'}},statuses:[204]});
 else check(mounts['kv/'].type==='kv'&&mounts['kv/'].options.version==='2');
 const auth=(await bao('sys/auth')).json;
 if(!auth['approle/'])await bao('sys/auth/approle',{method:'POST',body:{type:'approle'},statuses:[204]});
 for(const [name,policyFile,kv] of [
  ['core','core-host-policy.hcl',{control_db_url:'postgresql://syndes_staging_core:'+corePassword+'@control-postgres:5432/syndes_staging_control',openfga_token:'stage-private-network-fga'}],
  ['tenant','tenant-db-policy.hcl',null],
 ]){
  const policy=await readFile('/run/bundle/'+policyFile,'utf8');
  check(!policy.includes('/production/')&&!policy.includes('"write"'));
  await bao('sys/policies/acl/stage-'+name,{method:'PUT',body:{policy},statuses:[204]});
  const rolePath='auth/approle/role/stage-'+name;
  const spec={token_policies:['stage-'+name],token_ttl:300,token_max_ttl:300,token_no_default_policy:true};
  const old=await bao(rolePath,{statuses:[200,404]});
  if(old.status===404)await bao(rolePath,{method:'POST',body:spec,statuses:[204]});
  else check(old.json.data.token_policies.length===1&&old.json.data.token_policies[0]==='stage-'+name&&old.json.data.token_no_default_policy===true);
  const roleId=(await bao(rolePath+'/role-id')).json.data.role_id;
  const roleFile='bao-'+name+'-role-id', secretFile='bao-'+name+'-secret-id';
  let sid;
  try{sid=await file(secretFile)}catch(e){if(e.code!=='ENOENT')throw e;
   sid=(await bao(rolePath+'/secret-id',{method:'POST',body:{},statuses:[200]})).json.data.secret_id;
   await writeFile(ROOT+secretFile,sid+'\n',{flag:'wx',mode:0o444});
  }
  try{check(await file(roleFile)===roleId)}catch(e){if(e.code!=='ENOENT')throw e;await writeFile(ROOT+roleFile,roleId+'\n',{flag:'wx',mode:0o444});}
  await chmod(ROOT+secretFile,0o444);await chmod(ROOT+roleFile,0o444);
  const key=name==='core'?'core-host':'tenants/1f5a8ce9-3f01-48cc-a013-2198d99e7510';
  const value=kv||{username:'syndes_t_1f5a8ce93f0148cca0132198d99e7510',password:await file('greenfield-pilot-tenant-db')};
  const existing=await bao('kv/data/multi-org-staging/'+key,{statuses:[200,404]});
  if(existing.status===404)await bao('kv/data/multi-org-staging/'+key,{method:'POST',body:{data:value}});
  else check(JSON.stringify(existing.json.data.data)===JSON.stringify(value)||Object.entries(value).every(([k,v])=>existing.json.data.data[k]===v));
  const login=(await request(BAO+'auth/approle/login',{method:'POST',body:{role_id:roleId,secret_id:sid}})).json.auth.client_token;
  await request(BAO+'kv/data/multi-org-staging/'+key,{token:login});
  for(const denied of ['production/core-host',name==='core'?'multi-org-staging/tenants/1f5a8ce93f0148cca0132198d99e7510':'multi-org-staging/core-host'])
   await request(BAO+'kv/data/'+denied,{token:login,statuses:[403]});
  await request(BAO+'auth/token/revoke-self',{token:login,method:'POST',statuses:[204]});
  await request(BAO+'kv/data/multi-org-staging/'+key,{token:login,statuses:[403]});
 }
 await chmod(ROOT+'org-reader-secret',0o444);
 console.log('STAGE_RUNTIME_OPENBAO_TLS_APPROLE_OWN_READ_PRODUCTION_CROSS_ROLE_DENY_REVOKE_PASS');
 console.log('STAGE_RUNTIME_FOUNDATION_COMPLETE_NOT_CORE_HTTP');
}
main().catch(()=>{console.error('STAGE_RUNTIME_SETUP_BLOCKED='+phase);process.exitCode=1});
