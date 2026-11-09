#!/usr/bin/env bash
# Production Core Host main.js, but ONLY with disposable CI containers.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
[[ "$GITHUB_ACTIONS" == "true" && "$CI_RUNTIME_SMOKE" == "1" ]] || {
  echo "Refusing runtime smoke outside isolated CI" >&2;exit 2;
}
test -s /run/syndes/runtime/core_host_fga_store
export CORE_OPENFGA_STORE_ID
CORE_OPENFGA_STORE_ID="$(cat /run/syndes/runtime/core_host_fga_store)"
compose(){ docker compose --env-file infra/.env.ci -f apps/core-host/compose.yaml "$@"; }
compose config --quiet
docker build --file apps/core-host/Dockerfile --tag syndes-core-host:ci .
compose up -d --no-deps --no-build core-host
container_id="$(compose ps -q core-host)"
test -n "$container_id"
probe(){
  docker run --rm --network syndes-security-access \
    curlimages/curl:8.12.1 --silent --show-error --max-time 4 \
    --output /dev/null --write-out '%{http_code}' "$@" 2>/dev/null
}
ready=0
for attempt in $(seq 1 40);do
  if [[ "$(probe http://core-host:8082/readyz || true)" == "200" ]];then ready=1;break;fi
  if [[ "$(docker inspect --format '{{.State.Running}}' "$container_id")" != "true" ]];then
    echo "Production Core Host exited during bootstrap" >&2;exit 1
  fi
  sleep 2
done
[[ "$ready" == "1" ]] || { echo "Core Host readiness timeout" >&2;exit 1; }
assert_http(){
  local expected="$1" endpoint="$2";shift 2
  local got
  got="$(probe "$@" "http://core-host:8082$endpoint")"
  [[ "$got" == "$expected" ]] || {
    echo "Core Host HTTP mismatch at $endpoint: expected $expected, got $got" >&2;exit 1;
  }
  echo "HTTP $expected $endpoint"
}
assert_http 200 /healthz
assert_http 200 /readyz
assert_http 200 /modules/inbox/config
assert_http 200 /modules/crm/config
assert_http 404 /modules/unknown/config
assert_http 200 /inbox
assert_http 200 /inbox/app.js
assert_http 200 /inbox/styles.css
assert_http 200 /crm
assert_http 200 /crm/app.js
assert_http 401 /v1/tenants/4ab44379-d557-4df6-a2be-d44e121a8077/inbox/conversations
assert_http 401 /v1/tenants/4ab44379-d557-4df6-a2be-d44e121a8077/crm/people
assert_http 401 /v1/tenants/4ab44379-d557-4df6-a2be-d44e121a8077/authorize \
  -X POST -H 'Content-Type: application/json' -d '{"action":"read","resource":"inbox:conversations"}'
assert_http 405 /inbox -X POST
ports="$(docker inspect "$container_id" --format '{{json .HostConfig.PortBindings}}')"
[[ "$ports" == "null" || "$ports" == "{}" ]] || {
 echo "Core Host unexpectedly bound a public host port" >&2;exit 1;
}
if docker inspect "$container_id" --format '{{json .Config.Env}}' |
 grep -Eq 'CORE_CONTROL_DB_URL|CORE_OPENFGA_TOKEN|OPENFGA_PRESHARED_KEY';then
 echo "Core Host leaked bootstrap credential names in environment" >&2;exit 1;
fi
echo "PRODUCTION_CORE_HOST_RUNTIME_SMOKE: PASS (real main.js, OpenBao, PostgreSQL, Keycloak, OpenFGA)"
