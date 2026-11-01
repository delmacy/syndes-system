#!/usr/bin/env bash
set -Eeuo pipefail
compose=(docker compose --env-file infra/.env.ci -f infra/postgres/compose.yaml)
attempt=0
until "${compose[@]}" exec -T postgres pg_isready -U postgres -d postgres >/dev/null 2>&1; do
  attempt=$((attempt+1))
  if ((attempt >= 40)); then echo "PostgreSQL not ready" >&2; exit 1; fi
  sleep 2
done
for db in syndes_control syndes_keycloak syndes_openfga; do
  "${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U postgres -d "$db" -Atc 'SELECT current_database()' | grep -qx "$db"
done
"${compose[@]}" exec -T postgres sh -c 'PGPASSWORD="$PG_KEYCLOAK_PASSWORD" psql -h 127.0.0.1 -U syndes_keycloak -d syndes_keycloak -Atc "SELECT 1"' | grep -qx 1
if "${compose[@]}" exec -T postgres sh -c 'PGPASSWORD="$PG_KEYCLOAK_PASSWORD" psql -h 127.0.0.1 -U syndes_keycloak -d syndes_control -Atc "SELECT 1"' >/dev/null 2>&1; then
  echo "Keycloak role can access control-plane database" >&2; exit 1
fi
export TENANT_ID=4ab44379-d557-4df6-a2be-d44e121a8077
export TENANT_DB_PASSWORD=ci-tenant-secret-never-use-in-production
for i in 1 2; do
  "${compose[@]}" exec -T -e TENANT_ID -e TENANT_DB_PASSWORD postgres bash /opt/syndes/provision-tenant.sh
done
db="syndes_tenant_${TENANT_ID//-/}"
"${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U postgres -d syndes_control -Atc \
  "SELECT database_name FROM tenant_registry WHERE tenant_id='$TENANT_ID' AND state='provisioned'" | grep -qx "$db"
"${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atc \
  "SELECT count(*) FROM pg_database WHERE datname='$db'" | grep -qx 1
if "${compose[@]}" exec -T postgres sh -c 'PGPASSWORD="$PG_CORE_PASSWORD" psql -h 127.0.0.1 -U syndes_core -d '"$db"' -Atc "SELECT 1"' >/dev/null 2>&1; then
  echo "Core service role can connect to a tenant database" >&2; exit 1
fi
echo "All PostgreSQL isolation and provisioning smoke tests passed."
