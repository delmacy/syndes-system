#!/usr/bin/env bash
# Disposable PostgreSQL proof: Master role can read only Control DB.
# Requires Docker. Never point this fixture at a persistent PostgreSQL instance.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
container="syndes-platform-manager-pg-${GITHUB_RUN_ID:-local}-$$"
network="$container-data"
fixture="$(mktemp -d)"
cleanup(){
  docker rm -f "$container" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  rm -rf "$fixture"
}
trap cleanup EXIT

docker network create --internal "$network" >/dev/null
docker run --rm -d --name "$container" --network "$network" --network-alias syndes-control-postgres \
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
-- Deliberately reproduce the real DevServer01 legacy defect: PUBLIC CONNECT.
SQL

docker cp infra/postgres/bootstrap/control.schema "$container":/tmp/control.schema
docker cp infra/postgres/bootstrap/control-admin.schema "$container":/tmp/control-admin.schema
docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d syndes_control -f /tmp/control.schema >/dev/null
docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d syndes_control -f /tmp/control-admin.schema >/dev/null
docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d syndes_control -f /tmp/control-admin.schema >/dev/null
docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d syndes_control \
  -c "INSERT INTO platform_operator_access(principal_id,role) VALUES('ci-provision-fixture','owner')" >/dev/null
# Fail closed for a tenant database not bound to a unique Control registry row.
if docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres -d syndes_control \
  < scripts/deploy/sql/manager-tenant-connect-acl.sql >/dev/null 2>&1; then
  echo "Tenant ACL repair unexpectedly accepted an unregistered database" >&2; exit 1
fi
docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d syndes_control \
  -c "INSERT INTO tenant_registry(tenant_id,database_name,role_name) VALUES('11111111-1111-4111-8111-111111111111','syndes_tenant_11111111111141118111111111111111','syndes_t_11111111111141118111111111111111')" >/dev/null
for attempt in 1 2; do
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres -d syndes_control \
    < scripts/deploy/sql/manager-tenant-connect-acl.sql >/dev/null
done
acl="$(docker exec "$container" psql -XqAt -U postgres -d syndes_control \
  -c "SELECT has_database_privilege('syndes_master_api','syndes_tenant_11111111111141118111111111111111','CONNECT')::int::text || ':' || has_database_privilege('syndes_t_11111111111141118111111111111111','syndes_tenant_11111111111141118111111111111111','CONNECT')::int::text")"
[ "$acl" = '0:1' ] || { echo "Tenant database ACL postcondition failed" >&2; exit 1; }
docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d syndes_control \
  -c "DELETE FROM tenant_registry WHERE tenant_id='11111111-1111-4111-8111-111111111111'" >/dev/null
PYTHONDONTWRITEBYTECODE=1 python3 - "$container" "$network" "$fixture" <<'PY'
from pathlib import Path
import runpy
import sys

db, network, fixture = sys.argv[1:]
runtime = Path(fixture) / "runtime"
provision = runpy.run_path("infra/master-admin/provision-db-file.py")["provision"]
provision(runtime, db, network)
credential = (runtime / "master_db_url").read_bytes()
provision(runtime, db, network)
assert (runtime / "master_db_url").read_bytes() == credential
try:
    provision(Path(fixture) / "unknown", db, network)
except RuntimeError as exc:
    assert str(exc) == "Manager role already has a password from a different bootstrap"
else:
    raise AssertionError("Existing login was unexpectedly replaced")
PY
docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d syndes_control \
  -c "DELETE FROM platform_operator_access WHERE principal_id='ci-provision-fixture'" >/dev/null
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
