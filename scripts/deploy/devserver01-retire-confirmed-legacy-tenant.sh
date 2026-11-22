#!/usr/bin/env bash
# Remove the confirmed legacy tenant from service, without touching other tenants.
set -Eeuo pipefail
phase=authorization
trap 'result=$?; if ((result)); then printf "DEVSERVER01_LEGACY_OPERATION_BLOCKED phase=%s status=%s\n" "$phase" "$result" >&2; fi' EXIT
[[ "${SYNDES_LEGACY_RETIREMENT_APPROVAL:-}" == DEVSERVER01_APPROVED_8d22676bfedb ]] || exit 2
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
[[ "$state" == active || "$state" == suspended ]] || exit 3
phase=replacement
[[ "$(psql_server syndes_control -c "
 SELECT count(*) FROM public.tenant_registry
 WHERE left(encode(sha256(convert_to(tenant_id::text,'UTF8')),'hex'),12)='a7c825f1fa4d'
  AND state IN ('provisioned','active') AND database_name<>'$db' AND role_name<>'$role'
")" == 1 ]] || exit 3

phase=database-state
connections_allowed="$(psql_server postgres -c "SELECT datallowconn FROM pg_database WHERE datname='$db' AND NOT datistemplate")"
if [[ "$connections_allowed" == t ]];then
 phase=legacy-indices
 [[ "$(psql_server "$db" -c "
  SELECT count(*) FROM pg_indexes WHERE schemaname='public'
  AND indexname IN ('platform_legacy_single_organization','platform_legacy_single_workspace')
 ")" == 2 ]] || exit 4
 phase=legacy-topology
 [[ "$(psql_server "$db" -c "
  SELECT count(*)::text||':'||(SELECT count(*) FROM public.platform_workspaces WHERE tenant_id='$tenant')::text
  FROM public.platform_organizations WHERE tenant_id='$tenant'
 ")" == 1:1 ]] || exit 4
elif [[ "$connections_allowed" != f || "$state" != suspended ]];then
 exit 4
fi

phase=suspend-registry
if [[ "$state" == active ]];then
 [[ "$(psql_server syndes_control -c "
  WITH changed AS (
   UPDATE public.tenant_registry SET state='suspended'
   WHERE tenant_id='$tenant' AND database_name='$db' AND role_name='$role' AND state='active'
   RETURNING tenant_id
  ) SELECT count(*) FROM changed
 ")" == 1 ]] || exit 4
fi
phase=fence-database
if [[ "$connections_allowed" == t ]];then
 psql_server postgres -c "ALTER DATABASE $db WITH ALLOW_CONNECTIONS false" >/dev/null
fi
[[ "$(psql_server postgres -c "SELECT datallowconn FROM pg_database WHERE datname='$db'")" == f ]] || exit 5
# Existing sessions retain their connections when ALLOW_CONNECTIONS changes.
# Disconnect only backends bound to the confirmed database.
psql_server postgres -c "
 SELECT pg_terminate_backend(pid,5000) FROM pg_stat_activity
 WHERE datname='$db' AND backend_type='client backend'
" >/dev/null
[[ "$(psql_server postgres -c "SELECT count(*) FROM pg_stat_activity WHERE datname='$db' AND backend_type='client backend'")" == 0 ]] || exit 5
[[ "$(psql_server syndes_control -c "SELECT state FROM public.tenant_registry WHERE tenant_id='$tenant' AND database_name='$db' AND role_name='$role'")" == suspended ]] || exit 5
echo DEVSERVER01_CONFIRMED_LEGACY_TENANT_8d22676bfedb_OUT_OF_SERVICE
