#!/usr/bin/env bash
set -Eeuo pipefail
[[ "${SYNDES_TENANT_INVENTORY:-}" == ACTIONS_READ_ONLY_DEVSERVER01 ]] || exit 2
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || exit 2
inventory(){
 local label_kind="$1" pg="$2" control="$3" rows
 [[ "$pg" =~ ^[a-f0-9]{12,64}$ ]] || exit 3
 rows="$(docker exec -e 'PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=6000' "$pg" psql -XAt -F '|' -v ON_ERROR_STOP=1 -U postgres -d "$control" -c 'SELECT tenant_id::text,database_name,state FROM public.tenant_registry ORDER BY tenant_id LIMIT 501')"
 [[ -z "$rows" ]] && { printf '%s registries=0\n' "$label_kind"; return; }
 [[ "$(wc -l <<< "$rows")" -le 500 ]] || exit 3
 local tenant db state topology counts reference
 while IFS='|' read -r tenant db state; do
  [[ "$tenant" =~ ^[a-f0-9-]{36}$ && "$state" =~ ^[a-z_]+$ ]] || exit 3
  reference="$(printf '%s' "$tenant" | sha256sum | cut -c 1-12)"
  if [[ ! "$db" =~ ^syndes_tenant_[a-z0-9_]{1,49}$ ]]; then
   printf '%s tenant=%s state=%s topology=unverified_database_mapping\n' "$label_kind" "$reference" "$state"
   continue
  fi
  if ! topology="$(docker exec -e 'PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=6000' "$pg" psql -XAt -v ON_ERROR_STOP=1 -U postgres -d "$db" -c "SELECT CASE WHEN to_regclass('public.platform_organizations') IS NULL OR to_regclass('public.platform_workspaces') IS NULL THEN 'pre_hierarchy' WHEN count(*)=2 THEN 'sql002_legacy' WHEN count(*)=1 THEN 'partial_sql002' ELSE 'hierarchy_without_sql002' END FROM pg_indexes WHERE schemaname='public' AND indexname IN ('platform_legacy_single_organization','platform_legacy_single_workspace')" 2>/dev/null)"; then
   topology=unavailable
  fi
  counts=not_applicable
  if [[ "$topology" == hierarchy_without_sql002 || "$topology" == sql002_legacy ]]; then
   counts="$(docker exec -e 'PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=6000' "$pg" psql -XAt -v ON_ERROR_STOP=1 -U postgres -d "$db" -c "SELECT count(*)::text||':'||(SELECT count(*) FROM public.platform_workspaces WHERE tenant_id='$tenant')::text FROM public.platform_organizations WHERE tenant_id='$tenant'")"
  fi
  printf '%s tenant=%s state=%s topology=%s organizations:workspaces=%s\n' "$label_kind" "$reference" "$state" "$topology" "$counts"
 done <<< "$rows"
}
operational_pg="$(docker ps -q --filter label=com.docker.compose.project=syndes-postgres --filter label=com.docker.compose.service=postgres)"
stage_pg="$(docker ps -q --filter label=com.docker.compose.project=syndes-multiorg-staging --filter label=syndes.environment=multi-org-staging --filter label=syndes.component=control-postgres)"
[[ "$operational_pg" != "$stage_pg" ]] || exit 3
inventory operational "$operational_pg" syndes_control
inventory staging "$stage_pg" syndes_staging_control
manager="$(docker ps -q --filter label=com.docker.compose.project=syndes-master-admin)"
printf 'platform_manager_project_running_containers=%s\n' "$(awk 'NF{n++} END{print n+0}' <<< "$manager")"
