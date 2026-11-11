#!/usr/bin/env bash
# Explicitly operator-triggered SYNTHETIC Event Bus staging test.
# No production/control DB connection, no operations on existing Docker services.
set -Eeuo pipefail

if [[ "${1:-}" != "--disposable" || "${2:-}" != "--ack-synthetic" || "$#" -ne 2 ]]; then
  echo "Usage: bash scripts/events/run_disposable_staging.sh --disposable --ack-synthetic" >&2
  exit 2
fi
cd "$(dirname "$0")/../.."

pg_container="syndes-event-staging-pg17-20261111"
fga_container="syndes-events-fga-disposable-20261111"
pg_port=32770
fga_port=18090

cleanup() {
  local name image expected
  for name in "$fga_container" "$pg_container"; do
    if ! docker container inspect "$name" >/dev/null 2>&1; then
      continue
    fi
    if [[ "$name" == "$pg_container" ]]; then
      expected="event-staging-pg17"
      image="postgres:17-alpine"
    else
      expected="event-staging-fga"
      image="openfga/openfga:v1.22.1"
    fi
    if [[ "$(docker inspect -f '{{index .Config.Labels "syndes.disposable"}}' "$name")" != "$expected" ||
          "$(docker inspect -f '{{.Config.Image}}' "$name")" != "$image" ]]; then
      echo "Refusing cleanup of unrecognized container: $name" >&2
      continue
    fi
    docker stop --time 8 "$name" >/dev/null || true
  done
}
# Never stop a pre-existing container, even one with an expected name.
for name in "$pg_container" "$fga_container"; do
  if docker container inspect "$name" >/dev/null 2>&1; then
    echo "Disposable fixture name already exists, refusing replacement: $name" >&2
    exit 3
  fi
done
for port in "$pg_port" "$fga_port"; do
  if ss -lnt | grep -Eq ":$port[[:space:]]"; then
    echo "Disposable localhost port $port already occupied" >&2
    exit 4
  fi
done
trap cleanup EXIT

docker run --rm -d --name "$pg_container" \
  --label syndes.disposable=event-staging-pg17 \
  --memory 768m --pids-limit 128 -p "127.0.0.1:$pg_port:5432" \
  -e POSTGRES_PASSWORD=ci-only-disposable-stage-20261111 \
  postgres:17-alpine >/dev/null

docker run --rm -d --name "$fga_container" \
  --label syndes.disposable=event-staging-fga \
  --memory 512m --pids-limit 128 -p "127.0.0.1:$fga_port:8080" \
  openfga/openfga:v1.22.1 run --datastore-engine memory \
  --authn-method none --playground-enabled=false \
  --metrics-enabled=false >/dev/null

ready=false
for attempt in {1..30}; do
  if docker exec "$pg_container" pg_isready -U postgres -d postgres -q \
    && curl -fsS --max-time 2 "http://127.0.0.1:$fga_port/healthz" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  echo "Disposable PG17/OpenFGA readiness failed" >&2
  exit 5
fi

# Build dependencies only in this checkout; never touch the other UI worktree.
for folder in packages/core-kernel modules/core-crm modules/inbox \
  modules/whatsapp modules/organizations modules/support apps/core-host; do
  (cd "$folder" && npm ci --ignore-scripts --no-audit --no-fund --silent)
done
for folder in packages/core-kernel modules/core-crm modules/inbox \
  modules/whatsapp modules/organizations modules/support; do
  (cd "$folder" && npm run build --silent)
done
(cd apps/core-host && npm run link-peers --silent && npm run build --silent)

(
 cd apps/core-host
 SYNDES_EVENTS_PG_URL="postgresql://postgres:ci-only-disposable-stage-20261111@127.0.0.1:$pg_port/postgres" \
 SYNDES_EVENTS_DISPOSABLE=EVENTS_TEST_ONLY \
 SYNDES_EVENTS_FGA_URL="http://127.0.0.1:$fga_port" \
 SYNDES_EVENTS_FGA_DISPOSABLE=EVENTS_FGA_IN_MEMORY_ONLY \
 node --test test/platform-event-worker-batch.test.mjs \
  test/platform-events-disposable-staging-pg17-fga.test.mjs
)
echo "SYNTHETIC STAGING PASS: isolated PG17 + in-memory OpenFGA; no production activation"
