#!/usr/bin/env bash
# Disposable PostgreSQL proof: Master role can read only Control DB.
# Requires Docker. Never point this fixture at a persistent PostgreSQL instance.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
container="syndes-platform-manager-pg-${GITHUB_RUN_ID:-local}-$$"
cleanup(){ docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run --rm -d --name "$container" \
  -e POSTGRES_PASSWORD="ci-postgres-only" postgres:17-alpine >/dev/null

for attempt in $(seq 1 30); do
  # The image starts a socket-only temporary bootstrap server; TCP readiness
  # waits for the final PostgreSQL server after initdb scripts complete.
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres -d postgres >/dev/null 2>&1; then break; fi
  if [ "$attempt" -eq 30 ]; then echo "PostgreSQL did not start" >&2; exit 1; fi
  sleep 1
done

docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE syndes_core NOLOGIN;
CREATE DATABASE syndes_control;
CREATE ROLE syndes_t_11111111111141118111111111111111 LOGIN PASSWORD 'ci-tenant-only';
CREATE DATABASE syndes_tenant_11111111111141118111111111111111 OWNER syndes_t_11111111111141118111111111111111;
REVOKE CONNECT ON DATABASE syndes_tenant_11111111111141118111111111111111 FROM PUBLIC;
GRANT CONNECT ON DATABASE syndes_tenant_11111111111141118111111111111111 TO syndes_t_11111111111141118111111111111111;
SQL

docker cp infra/postgres/bootstrap/control.schema "$container":/tmp/control.schema
docker cp infra/postgres/bootstrap/control-admin.schema "$container":/tmp/control-admin.schema
docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d syndes_control -f /tmp/control.schema >/dev/null
docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d syndes_control -f /tmp/control-admin.schema >/dev/null
docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d syndes_control -f /tmp/control-admin.schema >/dev/null
docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -c "ALTER ROLE syndes_master_api PASSWORD 'ci-master-only'" >/dev/null

master_sql(){ docker exec -e PGPASSWORD="ci-master-only" "$container" \
  psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U syndes_master_api -d syndes_control -tAc "$1"; }
role="$(master_sql 'SELECT current_user')"
[ "$role" = "syndes_master_api" ] || { echo "Wrong DB role" >&2; exit 1; }
[ "$(master_sql 'SELECT count(*) FROM tenant_registry')" = "0" ] || exit 1
[ "$(master_sql 'SELECT count(*) FROM platform_operator_access')" = "0" ] || exit 1
[ "$(master_sql 'SELECT count(*) FROM platform_tenant_profiles')" = "0" ] || exit 1
[ "$(master_sql "SELECT rolsuper::int::text || rolcreatedb::int::text || rolcreaterole::int::text FROM pg_roles WHERE rolname=current_user")" = "000" ] || exit 1

if master_sql "INSERT INTO platform_operator_access(principal_id,role) VALUES ('invalid','owner')" >/dev/null 2>&1; then
  echo "Master role unexpectedly permitted write" >&2; exit 1
fi
if docker exec -e PGPASSWORD="ci-master-only" "$container" \
  psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U syndes_master_api \
  -d syndes_tenant_11111111111141118111111111111111 -tAc "SELECT 1" >/dev/null 2>&1; then
  echo "Master role unexpectedly connected to tenant DB" >&2; exit 1
fi
echo "Disposable PostgreSQL: Control-only SELECT, no writes, no tenant CONNECT, no superuser — PASS"
