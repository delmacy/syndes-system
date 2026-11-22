#!/usr/bin/env bash
# Purge the confirmed tenant database after fencing the legacy gateway accounts.
set -Eeuo pipefail
phase=authorization
trap 'result=$?; if ((result)); then printf "DEVSERVER01_LEGACY_OPERATION_BLOCKED phase=%s status=%s\n" "$phase" "$result" >&2; fi' EXIT
[[ "${SYNDES_LEGACY_PURGE_APPROVAL:-}" == DEVSERVER01_PURGE_8d22676bfedb ]] || exit 2
[[ "${SOURCE_SHA:-}" =~ ^[a-f0-9]{40}$ ]] || exit 2
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || exit 2

phase=postgres-container
pg="$(docker ps -q --filter label=com.docker.compose.project=syndes-postgres --filter label=com.docker.compose.service=postgres)"
[[ "$pg" =~ ^[a-f0-9]{12,64}$ ]] || exit 3

psql_server(){
 local database="$1"
 shift
 docker exec -e 'PGOPTIONS=-c statement_timeout=15000 -c lock_timeout=3000' "$pg" \
  psql -XAt -v ON_ERROR_STOP=1 -U postgres -d "$database" "$@"
}
phase=postgres-version
version="$(psql_server postgres -c "SHOW server_version_num")"
[[ "$version" =~ ^17[0-9]{4}$ ]] || exit 3
phase=registry
row="$(psql_server syndes_control -F '|' -c "
 SELECT tenant_id::text,database_name,role_name,state FROM public.tenant_registry
 WHERE left(encode(sha256(convert_to(tenant_id::text,'UTF8')),'hex'),12)='8d22676bfedb'
")"
[[ "$row" != *$'\n'* ]] || exit 3
IFS='|' read -r tenant db role state <<< "$row"
[[ "$tenant" =~ ^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$ ]] || exit 3
[[ "$db" =~ ^syndes_tenant_[a-f0-9]{32}$ && "$role" =~ ^syndes_t_[a-f0-9]{32}$ ]] || exit 3
[[ "$state" == suspended ]] || exit 3
phase=replacement
[[ "$(psql_server syndes_control -c "
 SELECT count(*) FROM public.tenant_registry
 WHERE left(encode(sha256(convert_to(tenant_id::text,'UTF8')),'hex'),12)='a7c825f1fa4d'
  AND state IN ('provisioned','active') AND database_name<>'$db' AND role_name<>'$role'
")" == 1 ]] || exit 3

phase=database-state
connections_allowed="$(psql_server postgres -c "SELECT datallowconn FROM pg_database WHERE datname='$db' AND NOT datistemplate")"
[[ -z "$connections_allowed" || "$connections_allowed" == f ]] || exit 4
[[ "$(psql_server postgres -c "SELECT count(*) FROM pg_stat_activity WHERE datname='$db'")" == 0 ]] || exit 4

# Read and disable only the legacy tenant's own gateway accounts using the
# existing private Core credential. No sensitive gateway responses leave Core.
phase=gateway
core="$(docker ps -q --filter name='^/syndes-core-host-whatsapp-v2$' --filter label=com.docker.compose.service=core-host-whatsapp)"
[[ "$core" =~ ^[a-f0-9]{12}$ ]] || exit 5
docker exec -i "$core" node --input-type=module - "$tenant" <<'JS'
import {createHmac} from 'node:crypto';
const tenant=process.argv[2];
const uuid=/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
if(!uuid.test(tenant))process.exit(2);
try{
 const url=new URL(process.env.WHATSAPP_GATEWAY_URL);
 const secret=process.env.WHATSAPP_WHATSMEOW_TOKEN;
 if(url.protocol!=='http:'||url.hostname!=='whatsapp-gateway'||!secret||
    url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error();
 const auth='Bearer '+createHmac('sha256',secret).update('syndes-whatsapp-v1:'+tenant+':tenant-registry').digest('hex');
 const base='/v1/tenants/'+tenant+'/accounts';
 async function request(path,method,body){
  const response=await fetch(new URL(path,url),{method,redirect:'error',signal:AbortSignal.timeout(7000),
   headers:{authorization:auth,...(body?{'content-type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
  if(!response.ok)throw Error();
  return response.json();
 }
 async function list(){
  const accounts=await request(base,'GET');
  if(!Array.isArray(accounts)||accounts.some(row=>row.tenantId!==tenant||!uuid.test(row.accountId)||
    typeof row.enabled!=='boolean'||typeof row.connected!=='boolean'))throw Error();
  return accounts;
 }
 for(const account of await list()){
  if(account.enabled||account.connected){
   const result=await request(base+'/'+account.accountId+'/enabled','PATCH',{enabled:false});
   if(result.enabled!==false)throw Error();
  }
 }
 if((await list()).some(account=>account.enabled||account.connected))throw Error();
 console.log('DEVSERVER01_CONFIRMED_LEGACY_GATEWAY_ACCOUNTS_DISABLED');
}catch{console.error('DEVSERVER01_LEGACY_PURGE_BLOCKED_GATEWAY_VERIFICATION');process.exitCode=5}
JS

# The database identifier is derived from the matched, suspended tenant UUID.
# No FORCE, so an unexpected connection or resource pin blocks the purge.
phase=purge
if [[ "$connections_allowed" == f ]];then
 psql_server postgres -c "DROP DATABASE $db" >/dev/null
fi
[[ "$(psql_server postgres -c "SELECT count(*) FROM pg_database WHERE datname='$db'")" == 0 ]] || exit 6
[[ "$(psql_server syndes_control -c "SELECT state FROM public.tenant_registry WHERE tenant_id='$tenant' AND database_name='$db' AND role_name='$role'")" == suspended ]] || exit 6
echo DEVSERVER01_CONFIRMED_LEGACY_PHYSICAL_DATABASE_REMOVED_AUDIT_PRESERVED
