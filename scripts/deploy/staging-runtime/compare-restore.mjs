// No row/secret output: compare every restored user table by count and content hash.
import {readFile,writeFile} from 'node:fs/promises';
import pg from '/workspace/apps/core-host/node_modules/pg/lib/index.js';
const allowed=new Set(['syndes_staging_control','syndes_staging_keycloak','syndes_staging_openfga','syndes_tenant_1f5a8ce93f0148cca0132198d99e7510','syndes_tenant_22222222222242228222222222222222']);
const quote=s=>'"'+s.replaceAll('"','""')+'"';
async function main(){
 if(process.env.SYNDES_STAGE_RESTORE!=='ACTIONS_STAGE_ONLY')throw Error();
 const pairs=JSON.parse(await readFile('/run/runtime/restore-map.json','utf8'));
 if(pairs.length!==5)throw Error();
 const password=(await readFile('/run/stage/pg-admin','utf8')).trim();
 let tables=0;
 for(const {source,target} of pairs){
  if(!allowed.has(source)||!/^syndes_restore_[a-f0-9]{12}_[0-4]$/.test(target))throw Error();
  const from=new pg.Pool({host:'control-postgres',user:'postgres',password,database:source,max:1});
  const to=new pg.Pool({host:'control-postgres',user:'postgres',password,database:target,max:1});
  try{
   const query="SELECT schemaname,tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY schemaname,tablename";
   const a=(await from.query(query)).rows,b=(await to.query(query)).rows;
   if(JSON.stringify(a)!==JSON.stringify(b))throw Error();
   for(const t of a){
    const sql='SELECT count(*)::text AS count,md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,\'[]\')) AS hash FROM '+quote(t.schemaname)+'.'+quote(t.tablename)+' t';
    if(JSON.stringify((await from.query(sql)).rows)!==JSON.stringify((await to.query(sql)).rows))throw Error();
    tables++;
   }
   if(source.startsWith('syndes_tenant_1f')){
    const indices=(await to.query("SELECT count(*)::int n FROM pg_indexes WHERE indexname IN ('platform_legacy_single_organization','platform_legacy_single_workspace')")).rows[0].n;
    if(indices!==0)throw Error();
    const scope=(await to.query('SELECT (SELECT count(*) FROM platform_organizations)::int o,(SELECT count(*) FROM platform_workspaces)::int w')).rows[0];
    if(scope.o!==2||scope.w!==4)throw Error();
   }
  }finally{await from.end();await to.end()}
 }
 await writeFile('/run/runtime/restore-proof.json',JSON.stringify({sourceSha:process.env.SOURCE_SHA,databases:5,tables,passed:true,at:new Date().toISOString()}),{mode:0o644});
 console.log('STAGE_RESTORE_FIVE_REAL_DATABASES_ALL_TABLE_COUNTS_HASHES_MULTI_ORG_SQL002_STATE_PASS');
}
main().catch(()=>{console.error('STAGE_RESTORE_COMPARISON_BLOCKED');process.exitCode=1});
