#!/usr/bin/env bash
# SM-02 synthetic domain acceptance; no operational databases.
set -Eeuo pipefail
if [[ "${1:-}" != "--disposable" || "${2:-}" != "--ack-synthetic" || "$#" -ne 2 ]]; then
  printf 'Usage: bash scripts/service-management/run_disposable_pg17.sh --disposable --ack-synthetic\n' >&2
  exit 2
fi
cd "$(dirname "$0")/../.."
name="syndes-funnel-pg17-20261111"
label="funnel-mvp-pg17"
image="postgres:17-alpine"
port=32772
if docker container inspect "$name" >/dev/null 2>&1; then
  echo "Refusing existing fixture name" >&2
  exit 3
fi
if ss -lnt | grep -Eq ":$port[[:space:]]"; then
  echo "Refusing port collision" >&2
  exit 4
fi
created=false
cleanup(){
  if [[ "$created" != true ]]; then return; fi
  if ! docker container inspect "$name" >/dev/null 2>&1; then return; fi
  if [[ "$(docker inspect -f '{{.Config.Image}}' "$name")" != "$image" ||
        "$(docker inspect -f '{{index .Config.Labels "syndes.disposable"}}' "$name")" != "$label" ]]; then
    echo "Refusing unsafe cleanup of unknown container" >&2
    return
  fi
  docker stop --time 7 "$name" >/dev/null || true
}
trap cleanup EXIT

# Host localhost is the only exposed port; no persistent mounts or volumes.
docker run --rm -d --name "$name" --label "syndes.disposable=$label" \
 --memory 768m --pids-limit 128 -p "127.0.0.1:$port:5432" \
 -e POSTGRES_PASSWORD=ci-only-disposable-funnel-20261111 "$image" >/dev/null
created=true
ready=false
for _ in {1..30}; do
  if docker exec "$name" pg_isready -q -U postgres -d postgres; then
    ready=true; break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  echo "Disposable PostgreSQL 17 did not start" >&2
  exit 5
fi
(cd packages/core-kernel && npm ci --ignore-scripts --no-audit --no-fund --silent && npm run build --silent)
(
 cd modules/service-management
 npm ci --ignore-scripts --no-audit --no-fund --silent
 SYNDES_FUNNEL_PG_URL="postgresql://postgres:ci-only-disposable-funnel-20261111@127.0.0.1:$port/postgres" \
 SYNDES_FUNNEL_DISPOSABLE=FUNNEL_PG17_ONLY npm test --silent
)

# Installer contract runs against the SAME disposable PG17 cluster only.
# Prepare the shared Nest packages in this isolated worktree, then exercise
# PgModuleInstaller plan/apply/verify with actual Service SQL + protected ledger.
# No Control production client, no real tenant database, no operational DDL.
for folder in modules/organizations modules/core-crm modules/inbox modules/whatsapp modules/support; do
 (cd "$folder" && npm ci --ignore-scripts --no-audit --no-fund --silent && npm run build --silent)
done
(
 cd apps/core-host
 npm ci --ignore-scripts --no-audit --no-fund --silent
 npm run link-peers --silent
 npm run build --silent
 SYNDES_FUNNEL_PG_URL="postgresql://postgres:ci-only-disposable-funnel-20261111@127.0.0.1:$port/postgres" \
 SYNDES_FUNNEL_DISPOSABLE=FUNNEL_PG17_ONLY node --test \
  test/service-release.test.mjs test/service-installer-pg17.test.mjs
)
echo "SERVICE FUNNEL SM-03C DOMAIN + OFFICIAL INSTALLER PASSED on synthetic disposable PG17; no operational migrations"
