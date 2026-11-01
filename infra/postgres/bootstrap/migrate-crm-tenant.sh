#!/usr/bin/env bash
# Operator-only CRM migration for an already provisioned, approved tenant.
# No tenant can select a database by passing an arbitrary client-provided name.
set -Eeuo pipefail
cd "$(dirname "$0")/../../.."
: "${TENANT_ID:?Operator must provide canonical lowercase UUID}"
if [[ ! "$TENANT_ID" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$ ]];then
  echo "Invalid tenant identifier" >&2;exit 2
fi
db="syndes_tenant_${TENANT_ID//-/}"
compose=(docker compose --env-file infra/.env -f infra/postgres/compose.yaml)
# The registry is queried inside the trusted DB, not from an untrusted HTTP request.
approved=$("${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U postgres -d syndes_control -At \
  -c "SELECT database_name FROM tenant_registry WHERE tenant_id='$TENANT_ID'::uuid AND state IN ('provisioned','active')" || true)
if [[ "$approved" != "$db" ]];then
  echo "Tenant not provisioned in canonical Control DB" >&2;exit 3
fi
for file in 001_crm_foundation.sql 002_crm_tags_notes.sql 003_crm_employees_channels.sql;do
  echo "Applying CRM migration $file to canonical tenant database"
  # DDL must be owned by the tenant's dedicated database role, not postgres.
  role="syndes_t_${TENANT_ID//-/}"
  { printf 'SET ROLE %s;\n' "$role"; cat "modules/core-crm/sql/$file"; } |
    "${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U postgres -d "$db" >/dev/null
done
echo "CRM tenant migrations applied; tenant membership/authorization not modified."
