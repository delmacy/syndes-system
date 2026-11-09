#!/bin/bash
# Run only via authorized database operations, NEVER exposed as a public HTTP API.
set -Eeuo pipefail
: "${TENANT_ID:?Expected canonical UUID}"
: "${TENANT_DB_PASSWORD:?Expected unique tenant database password}"
if [[ ! "$TENANT_ID" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$ ]]; then
  echo "TENANT_ID must be a lowercase canonical UUID" >&2; exit 2
fi
compact="${TENANT_ID//-/}"
role="syndes_t_${compact}"
db="syndes_tenant_${compact}"
# Stable identity and database naming are independent of the customer's company name.
psql -v ON_ERROR_STOP=1 -U postgres -d postgres -v role_name="$role" -v db_name="$db" <<'SQL'
\getenv tenant_pwd TENANT_DB_PASSWORD
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'role_name', :'tenant_pwd')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=:'role_name') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'db_name', :'role_name')
 WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname=:'db_name') \gexec
SELECT format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', :'db_name') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'db_name', :'role_name') \gexec
SQL
psql -v ON_ERROR_STOP=1 -U postgres -d syndes_control -v tenant_id="$TENANT_ID" -v db_name="$db" -v role_name="$role" <<'SQL'
INSERT INTO tenant_registry(tenant_id,database_name,role_name,state)
VALUES (:'tenant_id'::uuid, :'db_name', :'role_name','provisioned')
ON CONFLICT(tenant_id) DO UPDATE SET database_name=excluded.database_name, role_name=excluded.role_name
WHERE tenant_registry.database_name=excluded.database_name AND tenant_registry.role_name=excluded.role_name;
SQL
echo "Tenant database provisioned (not activated): $db"
