#!/usr/bin/env bash
# Dedicated account-access security checks. CI-only disposable PostgreSQL,
# never a real tenant or the persistent Syndes Control Plane.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."

bash tests/platform/account-roles-pg-smoke.sh

container="syndes-account-api-ci-pg"
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  sudo rm -f /run/secrets/ci-account-db-url /run/secrets/ci-account-fga-token 2>/dev/null || true
}
trap cleanup EXIT

docker run -d --name "$container" -p 127.0.0.1:15433:5432 \
  -e POSTGRES_PASSWORD=ci-account-admin-only \
  postgres:17-alpine >/dev/null

ready=false
for attempt in $(seq 1 45); do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres -d postgres >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 2
done
if [[ "$ready" != "true" ]]; then
  echo "::error::Disposable account-access PostgreSQL is not ready" >&2
  exit 1
fi

docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres \
  -d postgres -c 'CREATE DATABASE syndes_control' >/dev/null
sudo install -d -m 0700 -o "$(id -u)" -g "$(id -g)" /run/secrets

CI_ACCOUNT_PG=1 \
CI_PG_ADMIN_URL="postgresql://postgres:ci-account-admin-only@127.0.0.1:15433/syndes_control" \
node apps/account-access-api/test/pg-e2e.mjs

docker build -f apps/account-access-api/Dockerfile -t syndes/account-access-api:ci .
echo "Account delegation: unit + SQL roles + real HTTP/PG + container PASS"
