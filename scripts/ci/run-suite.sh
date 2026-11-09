#!/usr/bin/env bash
# Central CI suite executor. Old module workflows remain active during parity migration.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."

suite="$1"
if [[ -z "$suite" ]]; then echo "Suite name required" >&2; exit 2; fi

install() {
  (cd "$1" && npm ci --no-audit --no-fund)
}

build() {
  install "$1"
  (cd "$1" && npm run build)
}

build_kernel() { build packages/core-kernel; }

build_host_modules() {
  build_kernel
  for dir in modules/organizations modules/core-crm modules/inbox modules/whatsapp modules/support; do
    if [[ -f "$dir/package-lock.json" ]]; then build "$dir"; fi
  done
}

start_pg() {
  local name="$1" port="$2" password="$3" version="$4"
  docker run -d --name "$name" -p "127.0.0.1:$port:5432" \
    -e POSTGRES_PASSWORD="$password" postgres:"$version" >/dev/null
  trap 'docker rm -f "$pg_container" >/dev/null 2>&1 || true' EXIT
  for attempt in $(seq 1 45); do
    if docker exec "$name" pg_isready -U postgres -d postgres >/dev/null 2>&1; then return 0; fi
    sleep 2
  done
  echo "::error::PostgreSQL disposable service not ready ($name)" >&2
  exit 1
}

case "$suite" in
  noop)
    echo "No buildable component impacted; foundation gate still executed."
    ;;
  kernel)
    install packages/core-kernel
    (cd packages/core-kernel && npm run check && npm test && npm pack --dry-run)
    ;;
  organizations)
    build_kernel
    build modules/core-crm
    install modules/organizations
    pg_container="syndes-ci-org-pg"
    start_pg "$pg_container" 5432 "ci-only-disposable" 16
    (cd modules/organizations &&
      SYNDES_ORG_TEST_PG_URL="postgresql://postgres:ci-only-disposable@127.0.0.1:5432/postgres" npm test)
    ;;
  crm)
    build_kernel
    install modules/core-crm
    (cd modules/core-crm && npm run check && npm test && npm pack --dry-run)
    install apps/core-host
    bash modules/core-crm/test/postgres-integration.sh
    ;;
  inbox)
    build_host_modules
    install apps/core-host
    (cd apps/core-host && npm run link-peers && npm run build)
    (cd modules/inbox && npm run check && npm test && npm pack --dry-run)
    bash modules/inbox/test/postgres-integration.sh
    ;;
  whatsapp-ts)
    build_kernel
    install modules/whatsapp
    (cd modules/whatsapp && npm run check && npm test && npm pack --dry-run)
    ;;
  whatsapp-go)
    cd modules/whatsapp/gateway/whatsmeow
    go mod verify
    unformatted="$(find . -type f -name '*.go' -print0 | xargs -0 -r gofmt -l)"
    if [[ -n "$unformatted" ]]; then
      echo "::error::Go files require formatting: $unformatted" >&2
      exit 1
    fi
    pg_container="syndes-ci-whatsapp-pg"
    start_pg "$pg_container" 5432 "ci-whatsapp-only" 17
    export SYNDES_WHATSAPP_TEST_PG_DSN="postgres://postgres:ci-whatsapp-only@127.0.0.1:5432/postgres?sslmode=disable"
    go vet ./...
    go test -race -count=1 ./...
    go build ./...
    ;;
  host)
    build_host_modules
    install apps/core-host
    (cd apps/core-host && npm run check && npm test)
    docker build --file apps/core-host/Dockerfile --tag syndes-core-host:ci .
    ;;
  workspace)
    install apps/workspace-web
    (
      cd apps/workspace-web
      npm run build
      npm test
      npm run lint
      npx playwright install --with-deps chromium
      # Run every browser regression supported by the checked-out Workspace version.
      for name in test:smoke test:ui-anon test:inbox-ui test:crm-ui test:whatsapp-ui; do
        if SCRIPT_NAME="$name" node -e \
          'const p=require("./package.json");process.exit(Object.hasOwn(p.scripts||{},process.env.SCRIPT_NAME)?0:1)'; then
          npm run "$name"
        fi
      done
    )
    ;;
  support)
    build_kernel
    install modules/support
    (cd modules/support && npm run check && npm test && npm pack --dry-run)
    pg_container="syndes-ci-support-pg"
    start_pg "$pg_container" 5432 "ci-support-only" 16
    (cd modules/support &&
      SYNDES_SUPPORT_TEST_PG_URL="postgresql://postgres:ci-support-only@127.0.0.1:5432/postgres" \
      node --test test/pg-integration.test.mjs)
    ;;
  support-web)
    install apps/support-web
    (cd apps/support-web && npm run check && npm test && npm run build)
    test ! -e apps/support-web/dist/support-runtime.json
    ;;
  platform-api)
    install apps/master-admin-api
    (cd apps/master-admin-api && npm test)
    docker build -f apps/master-admin-api/Dockerfile -t syndes/master-admin-api:ci .
    ;;
  platform-web)
    install apps/master-admin-web
    (cd apps/master-admin-web &&
      npm run build &&
      npm test &&
      npx playwright install --with-deps chromium &&
      npm run test:browser)
    docker build -f apps/master-admin-web/Dockerfile -t syndes/master-admin-web:ci .
    ;;
  infra)
    bash scripts/ci/run-infra.sh
    ;;
  *)
    echo "::error::Unrecognized CI suite: $suite" >&2
    exit 2
    ;;
esac
