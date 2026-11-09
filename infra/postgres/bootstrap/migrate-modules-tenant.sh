#!/usr/bin/env bash
# Approved operator process: apply installed module migrations only to a
# verified, provisioned/active tenant database. No arbitrary paths or SQL args.
set -Eeuo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir/../../.."
source "$script_dir/support-migration-gate.sh"
: "${TENANT_ID:?Set approved, canonical tenant UUID}"
: "${SYNDES_CORE_HOST_IMAGE:?Set the approved immutable Core Host image digest}"
if [[ ! "$SYNDES_CORE_HOST_IMAGE" =~ ^[A-Za-z0-9._/:@-]+@sha256:[a-f0-9]{64}$ ]];then
  echo "Refusing mutable/unpinned Core Host image for tenant migrations" >&2;exit 2
fi
if [[ ! "$TENANT_ID" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$ ]];then
  echo "Invalid tenant UUID" >&2;exit 2
fi
command -v jq >/dev/null || { echo "jq required" >&2;exit 2; }
suffix="${TENANT_ID//-/}"
db="syndes_tenant_$suffix"
role="syndes_t_$suffix"
compose=(docker compose --env-file infra/.env -f infra/postgres/compose.yaml)
approved=$("${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U postgres -d syndes_control -At \
  -c "SELECT database_name FROM tenant_registry
    WHERE tenant_id='$TENANT_ID'::uuid AND state IN ('provisioned','active')" )
if [[ "$approved" != "$db" ]];then
  echo "No matching approved Control DB tenant mapping" >&2;exit 3
fi
installed=$(docker run --rm --read-only --network none --entrypoint node "$SYNDES_CORE_HOST_IMAGE" dist/migrations.js --list)
if ! jq -e 'type=="array" and all(.[]; .id|type=="string")' <<<"$installed" >/dev/null;then
  echo "Invalid trusted module manifest" >&2;exit 3
fi
while IFS=$'\t' read -r module migration;do
  [[ -z "$module" ]] && continue
  if [[ ! "$module" =~ ^[a-z][a-z0-9.-]*$ ||
        ! "$migration" =~ ^[0-9]{3}_[a-z0-9_]+$ ]];then
    echo "Invalid installed migration identifier" >&2;exit 3
  fi
  # This Host globally mounts Support API, but Support tables are exclusive
  # to Syndes' operational tenant, never to ordinary commercial tenants.
  if ! syndes_module_migration_allowed "$module" "$TENANT_ID";then
    continue
  fi
  echo "Applying $module/$migration to approved tenant"
  # Fail closed: no user-supplied SQL, name, role or filesystem path.
  {
    printf 'SET ROLE %s;\n' "$role"
    docker run --rm --read-only --network none --entrypoint node \
      "$SYNDES_CORE_HOST_IMAGE" dist/migrations.js --emit "$module" "$migration"
  } | "${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U postgres -d "$db" >/dev/null
done < <(jq -r '.[] | .id as $id | .migrations[] | [$id,.] | @tsv' <<<"$installed")
echo "Installed module migrations applied for approved tenant."
