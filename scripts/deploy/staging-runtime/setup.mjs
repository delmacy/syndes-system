// Trusted Actions operator for the isolated stage only; never imported by Core.
import {readFile,writeFile,chmod,lstat,mkdir,rename,unlink} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import pg from '/workspace/apps/core-host/node_modules/pg/lib/index.js';
const ROOT='/run/stage/';
const KC='https://identity-stage:8443';
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
 if(token)headers.Authorization='Bearer '+token;
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
async function writeRuntimeCredential(name,values){
 const target=ROOT+name;
 const content=JSON.stringify({namespace:'multi-org-staging',...values})+'\n';
 try{
  const old=await lstat(target);
  check(old.isFile()&&old.uid===process.getuid()&&(old.mode&0o777)===0o444);
  if(await readFile(target,'utf8')===content)return;
 }catch(e){if(e.code!=='ENOENT')throw e}
 const temporary=target+'.'+randomBytes(8).toString('hex');
 await writeFile(temporary,content,{flag:'wx',mode:0o444});
 try{await rename(temporary,target)}
 catch(e){await unlink(temporary);throw e}
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
 phase='file-credentials';
 const tid='1f5a8ce9-3f01-48cc-a013-2198d99e7510';
 const tenantRole='syndes_t_'+tid.replaceAll('-','');
 const tenantDb='syndes_tenant_'+tid.replaceAll('-','');
 const tenantPassword=await file('greenfield-pilot-tenant-db');
 check(/^[a-f0-9]{64}$/.test(tenantPassword));
 const tenantLogin=new pg.Pool({host:'control-postgres',user:tenantRole,
  password:tenantPassword,database:tenantDb,max:1});
 try{
  const identity=(await tenantLogin.query('SELECT current_database() AS db, current_user AS role')).rows[0];
  check(identity.db===tenantDb&&identity.role===tenantRole);
 }finally{await tenantLogin.end()}
 await writeRuntimeCredential('stage-core.json',{
  control_db_url:'postgresql://syndes_staging_core:'+corePassword+'@control-postgres:5432/syndes_staging_control',
  openfga_token:'stage-private-network-fga',
 });
 try{
  await mkdir(ROOT+'stage-tenants',{mode:0o755});
  await chmod(ROOT+'stage-tenants',0o755);
 }catch(e){if(e.code!=='EEXIST')throw e}
 const directory=await lstat(ROOT+'stage-tenants');
 check(directory.isDirectory()&&directory.uid===process.getuid()&&(directory.mode&0o777)===0o755);
 await writeRuntimeCredential('stage-tenants/'+tid+'.json',{username:tenantRole,password:tenantPassword});
 await chmod(ROOT+'org-reader-secret',0o444);
 console.log('STAGE_RUNTIME_FILE_CREDENTIALS_SCOPED_LOGIN_PASS');
 console.log('STAGE_RUNTIME_FOUNDATION_COMPLETE_NOT_CORE_HTTP');
}
main().catch(()=>{console.error('STAGE_RUNTIME_SETUP_BLOCKED='+phase);process.exitCode=1});
