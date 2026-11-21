import {readFile,writeFile,rm} from 'node:fs/promises';
import pg from '/workspace/apps/core-host/node_modules/pg/lib/index.js';
const context='/run/runtime/outage-context.json';
async function main(){
 if(process.env.SYNDES_STAGE_OUTAGE!=='ACTIONS_STAGE_ONLY')throw Error();
 const mode=process.env.OUTAGE_MODE;
 if(mode==='prepare'){
  const password=(await readFile('/run/stage/pilot-founder-password','utf8')).trim();
  const r=await fetch('https://identity-stage:8443/realms/syndes-pilot/protocol/openid-connect/token',{
   method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({grant_type:'password',client_id:'syndes-pilot-staging-login',username:'pilot-founder',password}),
   redirect:'error',signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw Error();const {access_token}=await r.json();
  await writeFile(context,JSON.stringify({token:access_token}),{mode:0o600});return;
 }
 if(mode==='cleanup'){await rm(context,{force:true});return}
 if(mode!=='check')throw Error();
 const {token}=JSON.parse(await readFile(context,'utf8'));
 const db=new pg.Pool({host:'control-postgres',user:'postgres',password:(await readFile('/run/stage/pg-admin','utf8')).trim(),database:'syndes_tenant_1f5a8ce93f0148cca0132198d99e7510',max:1});
 try{
  const count=async()=>Number((await db.query('SELECT count(*) n FROM inbox_events')).rows[0].n);
  const before=await count();
  const r=await fetch('http://core-host:8082/v1/tenants/1f5a8ce9-3f01-48cc-a013-2198d99e7510/inbox/conversations',{
   method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',
    'x-syndes-organization-id':'a3f80cc7-4c61-4f8e-8c39-d848dfbe10a1',
    'x-syndes-workspace-id':'cae8c1e2-4a1d-4b69-9e02-0dd15b0d1001'},
   body:JSON.stringify({subject:'MUST NOT WRITE WHILE PROVIDER DOWN'}),redirect:'error',signal:AbortSignal.timeout(14000)});
  if(![403,503].includes(r.status)||await count()!==before)throw Error();
  console.log('STAGE_REAL_PROVIDER_OUTAGE_HTTP_DENY_ZERO_AUDIT_WRITE_PASS');
 }finally{await db.end()}
}
main().catch(()=>{console.error('STAGE_PROVIDER_OUTAGE_BLOCKED');process.exitCode=1});
