#!/usr/bin/env bash
# Read-only Product Gate for an authorized DevServer01 homologation host.
# No secrets or customer records are printed. Requires Docker access.
set -Eeuo pipefail
pass=0
block=0
warn=0
ok(){ echo "PASS: $*"; pass=$((pass+1)); }
stop(){ echo "BLOCKED: $*"; block=$((block+1)); }
caution(){ echo "WARN: $*"; warn=$((warn+1)); }
db=syndes-postgres-postgres-1
kc=syndes-security-access-keycloak-1

if ! command -v docker >/dev/null || ! docker info >/dev/null 2>&1; then
  echo "BLOCKED: Docker unavailable"; exit 2
fi
if docker inspect "$db" >/dev/null 2>&1 &&
   docker inspect "$db" --format '{{.State.Health.Status}}' | grep -qx healthy; then
  ok "Shared PostgreSQL is healthy"
else stop "Shared PostgreSQL health unavailable"; fi

if docker inspect "$kc" --format '{{.State.Status}}' 2>/dev/null | grep -qx running; then
  ok "Existing Keycloak container running"
else stop "Keycloak unavailable"; fi

for spec in 'syndes-master-data|syndes-postgres-postgres-1' 'syndes-master-identity|syndes-security-access-keycloak-1'; do
  net=${spec%%|*}
  expected=${spec#*|}
  if ! docker network inspect "$net" >/dev/null 2>&1; then
    stop "Dedicated network $net absent"; continue
  fi
  internal=$(docker network inspect "$net" --format '{{.Internal}}')
  members=$(docker network inspect "$net" --format '{{range .Containers}}{{.Name}} {{end}}')
  # Allow only the existing backend and (once deployed) the specifically
  # labeled Manager API. The web service must never join either bridge.
  expected_seen=false
  admin_count=0
  valid=true
  for member in $members; do
    if [[ "$member" == "$expected" ]]; then
      expected_seen=true
    else
      label=$(docker inspect "$member" --format '{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}' 2>/dev/null || true)
      if [[ "$label" == "syndes-master-admin|master-api" ]]; then
        admin_count=$((admin_count+1))
      else
        valid=false
      fi
    fi
  done
  if [[ "$internal" != true || "$expected_seen" != true || "$valid" != true || "$admin_count" -gt 1 ]]; then
    stop "Dedicated network $net membership mismatch"
  else
    ok "$net is internal with only approved backend and Manager API (if deployed)"
  fi
done

query(){ docker exec -u postgres "$db" psql -w -X -v ON_ERROR_STOP=1 -U postgres -d syndes_control -tAc "$1"; }
if query "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('platform_operator_access','platform_tenant_profiles')" 2>/dev/null | grep -qx 2; then
  ok "Admin metadata schema installed"
else stop "Admin metadata schema unavailable"; fi

if query "SELECT count(*) FROM pg_roles WHERE rolname='syndes_master_api' AND rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole" 2>/dev/null | grep -qx 1; then
  ok "Dedicated non-superuser DB role exists"
else stop "Dedicated DB role incorrect"; fi

if query "SELECT has_table_privilege('syndes_master_api','platform_operator_access','SELECT') AND NOT has_table_privilege('syndes_master_api','platform_operator_access','INSERT,UPDATE,DELETE') AND NOT has_schema_privilege('syndes_master_api','public','CREATE')" 2>/dev/null | grep -qx t; then
  ok "DB role has read-only metadata permissions"
else stop "DB role has unsafe SQL grants"; fi

if docker exec -u postgres "$db" psql -w -X -U postgres -d postgres -tAc "SELECT count(*) FROM pg_database WHERE (datname LIKE 'syndes_tenant_%' OR datname IN ('syndes_keycloak','syndes_openfga')) AND has_database_privilege('syndes_master_api',oid,'CONNECT')" 2>/dev/null | grep -qx 0; then
  ok "DB role cannot connect to tenant, Keycloak or OpenFGA databases"
else stop "DB role has unauthorized DB connection privileges"; fi

if docker exec -u postgres "$db" psql -w -X -U postgres -d postgres -tAc "SELECT count(*) FROM pg_database WHERE datname='postgres' AND has_database_privilege('syndes_master_api',oid,'CONNECT')" 2>/dev/null | grep -qx 0; then
  ok "DB role cannot connect to postgres utility DB"
else caution "postgres utility DB permits CONNECT through PUBLIC (review before release)"; fi

if query "SELECT count(*) FROM pg_authid WHERE rolname='syndes_master_api' AND rolpassword IS NOT NULL" 2>/dev/null | grep -qx 1; then
  ok "Master DB role password set (no value disclosed)"
else stop "Master DB role has no runtime password"; fi

if query "SELECT count(*) FROM platform_operator_access WHERE role='owner' AND state='active'" 2>/dev/null | grep -Eq '^[1-9][0-9]*$'; then
  ok "At least one explicitly authorized platform owner exists"
else stop "No active platform owner provisioned"; fi

if command -v jq >/dev/null && docker exec syndes-security-access-openbao-1 bao status -format=json 2>/dev/null | jq -e '.initialized == true and .sealed == false' >/dev/null 2>&1; then
  ok "OpenBao initialized and unsealed"
else stop "OpenBao sealed or unavailable"; fi

if [[ -f /run/syndes/platform-manager/master_db_url ]]; then
  ok "Protected master DB runtime secret mounted (contents not read)"
else stop "Master DB runtime secret absent or inaccessible"; fi

if tailscale serve status 2>/dev/null | grep -q ':9446'; then
  ok "Dedicated Tailnet HTTPS route provisioned"
else stop "Dedicated Tailnet HTTPS route not configured"; fi

if docker ps --format '{{.Names}}' | grep -qE '^.*master-(api|web)'; then
  ok "Standalone manager runtime container detected"
else stop "Standalone manager runtime not started"; fi

echo "GATE SUMMARY: PASS=$pass BLOCKED=$block WARN=$warn"
if [[ "$block" -gt 0 ]]; then exit 2; fi
if [[ "$warn" -gt 0 ]]; then exit 1; fi
exit 0
