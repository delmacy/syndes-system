#!/usr/bin/env bash
# Single mainline suite executor. Critical legacy coverage is pinned by parity.test.mjs.
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
  for dir in modules/organizations modules/core-crm modules/inbox modules/whatsapp modules/support modules/service-management; do
    if [[ -f "$dir/package-lock.json" ]]; then build "$dir"; fi
  done
}

start_pg() {
  local name="$1" port="$2" password="$3" version="$4" label="${5:-}"
  local label_args=()
  if [[ -n "$label" ]]; then label_args=(--label "syndes.disposable=$label"); fi
  docker run -d --name "$name" "${label_args[@]}" -p "127.0.0.1:$port:5432" \
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
  service-management)
    # IAM07D4 real Service stage mutation runs through the SAME candidate Host
    # epoch fence. Build module dependencies first, with no operational deploy.
    build_host_modules
    build modules/service-management
    install apps/core-host
    (cd apps/core-host && npm run build)
    pg_container="syndes-funnel-pg17-20261111"
    start_pg "$pg_container" 32772 "ci-only-disposable-funnel-ci" "17-alpine" "funnel-mvp-pg17"
    (cd modules/service-management && npm run check &&
      SYNDES_FUNNEL_DISPOSABLE=FUNNEL_PG17_ONLY \
      SYNDES_FUNNEL_PG_URL="postgresql://postgres:ci-only-disposable-funnel-ci@127.0.0.1:32772/postgres" \
      npm test && npm pack --dry-run)
    # MO-REL-02: do not treat a skipped installer test as installation proof.
    # Run the official Service installer/ledger/rollback suite against this
    # disposable PG17 fixture, using only its explicitly pinned test switch.
    (cd apps/core-host &&
      SYNDES_FUNNEL_DISPOSABLE=FUNNEL_PG17_ONLY \
      SYNDES_FUNNEL_PG_URL="postgresql://postgres:ci-only-disposable-funnel-ci@127.0.0.1:32772/postgres" \
      node --test test/service-installer-pg17.test.mjs)
    ;;
  whatsapp-ts)
    build_kernel
    # Cross-org regression also exercises real CRM repositories in the
    # disposable shared tenant fixture, so build the source being tested.
    build modules/core-crm
    install modules/whatsapp
    (cd modules/whatsapp && npm run check && npm test && npm pack --dry-run)
    # MO-REL-01: execute the actual cross-Organization SQL regression, not just
    # unit tests. This is a disposable PostgreSQL 17 instance, never a tenant DB.
    install apps/core-host
    pg_container="syndes-whatsapp-org-scope-pg17-ci"
    start_pg "$pg_container" 32781 "ci-only-disposable-wa-org-ci" "17-alpine" "wa-multiorg-pg17"
    (cd modules/whatsapp &&
      SYNDES_INBOX_SCOPE_TEST_PG_URL="postgresql://postgres:ci-only-disposable-wa-org-ci@127.0.0.1:32781/postgres" \
      node --test test/pg-org-scope.mjs)
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
    start_pg "$pg_container" 5432 "ci-whatsapp-superuser-only" 17
    docker exec "$pg_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
      -c "CREATE ROLE syndes_ci LOGIN PASSWORD 'syndes_ci_test_only'" >/dev/null
    docker exec "$pg_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
      -c "CREATE DATABASE syndes_whatsapp_test OWNER syndes_ci" >/dev/null
    export SYNDES_WHATSAPP_TEST_PG_DSN="postgres://syndes_ci:syndes_ci_test_only@127.0.0.1:5432/syndes_whatsapp_test?sslmode=disable"
    go vet ./...
    go test -race -count=1 ./...
    go build ./...
    ;;
  host)
    build_host_modules
    install apps/core-host
    (cd apps/core-host && npm run check && npm test)
    # IAM-04B candidate: one isolated PostgreSQL 17 Control rehearsal. No operational migration.
    pg_container="syndes-iam04b-pg17-ci"
    start_pg "$pg_container" 32779 "ci-only-disposable-iam-ci" "17-alpine" "iam04b-pg17"
    (cd apps/core-host && \
      SYNDES_IAM04_DISPOSABLE_PG=IAM04B_PG17_ONLY \
      SYNDES_IAM04_PG_URL="postgresql://postgres:ci-only-disposable-iam-ci@127.0.0.1:32779/postgres" \
      node --test test/iam-organization-links-pg17.test.mjs &&
      SYNDES_IAM04_DISPOSABLE_PG=IAM04B_PG17_ONLY \
      SYNDES_IAM04_PG_URL="postgresql://postgres:ci-only-disposable-iam-ci@127.0.0.1:32779/postgres" \
      node --test test/iam07d-revoke-first-pg17.test.mjs &&
      SYNDES_IAM04_DISPOSABLE_PG=IAM04B_PG17_ONLY \
      SYNDES_IAM04_PG_URL="postgresql://postgres:ci-only-disposable-iam-ci@127.0.0.1:32779/postgres" \
      node --test test/whatsapp-history-command-pg17.test.mjs &&
      # First-tenant signup Control reservation: real PG17, never runtime.
      SYNDES_IAM04_DISPOSABLE_PG=IAM04B_PG17_ONLY \
      SYNDES_IAM04_PG_URL="postgresql://postgres:ci-only-disposable-iam-ci@127.0.0.1:32779/postgres" \
      node --test test/signup-intents-pg17.test.mjs &&
      SYNDES_IAM04_DISPOSABLE_PG=IAM04B_PG17_ONLY \
      SYNDES_IAM04_PG_URL="postgresql://postgres:ci-only-disposable-iam-ci@127.0.0.1:32779/postgres" \
      node --test test/signup-first-tenant-installer-pg17.test.mjs &&
      SYNDES_IAM04_DISPOSABLE_PG=IAM04B_PG17_ONLY \
      SYNDES_IAM04_PG_URL="postgresql://postgres:ci-only-disposable-iam-ci@127.0.0.1:32779/postgres" \
      node --test test/signup-provisioned-tenant-provider-pg17.test.mjs &&
      SYNDES_IAM04_DISPOSABLE_PG=IAM04B_PG17_ONLY \
      SYNDES_IAM04_PG_URL="postgresql://postgres:ci-only-disposable-iam-ci@127.0.0.1:32779/postgres" \
      node --test test/signup-first-tenant-operator-pg17.test.mjs)
    docker build --file apps/core-host/Dockerfile --tag syndes-core-host:ci .
    ;;
  workspace)
    install apps/workspace-web
    (
      cd apps/workspace-web
      npm run build
      npm test
      npm run lint
      bash ../../scripts/ci/run-workspace-browser.sh
    )
    ;;
  support)
    build_kernel
    install modules/support
    (cd modules/support && npm run check && npm test && npm pack --dry-run)
    pg_container="syndes-ci-support-pg"
    start_pg "$pg_container" 5432 "ci-only-disposable" 16
    (cd modules/support &&
      SYNDES_SUPPORT_TEST_PG_URL="postgresql://postgres:ci-only-disposable@localhost:5432/postgres" \
      node --test test/pg-integration.test.mjs &&
      SYNDES_DISPOSABLE_RESTORE_REHEARSAL=true \
      SYNDES_SUPPORT_TEST_PG_URL="postgresql://postgres:ci-only-disposable@localhost:5432/postgres" \
      node test/pg-backup-restore.mjs)
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
  account-access)
    install apps/account-access-api
    (cd apps/account-access-api && npm test)
    bash scripts/ci/run-account-access.sh
    ;;
  infra)
    bash scripts/ci/run-infra.sh
    # IAM-09 qualification ONLY: after infrastructure compose cleanup, prove
    # checksum-verified PG17 Control+tenant synthetic backup/restore in a NEW
    # network-disabled container. Never mistake this for operational restore.
    python3 -m unittest scripts/events/test_disposable_restore_drill.py \
      scripts/events/test_staging_preflight.py -v
    restore_report="$(python3 scripts/events/disposable_restore_drill.py \
      --disposable --ack-synthetic --json)"
    printf '%s\n' "$restore_report" | python3 -c '
import json,sys
r=json.load(sys.stdin)
assert r["kind"]=="syndes_synthetic_pg17_restore_v1"
assert r["result"]=="passed_synthetic_only"
assert r["isolated"] is True and r["network"]=="none"
assert r["source"]=="synthetic_only"
assert r["production_backup_verified"] is False
assert r["production_restore_approved"] is False
assert r["operational_ddl_executed"] is False
required={"pg17","custom_archives","archive_sha256_verified",
"control_event_audit_restored","tenant_data_and_events_restored",
"tenant_delivery_inbox_restored","restored_control_trigger_operational",
"restored_control_acl_closed","restored_replay_idempotent",
"source_unchanged_after_replay"}
assert all(r["checks"].get(name) is True for name in required)
print("IAM09_SYNTHETIC_PG17_CONTROL_TENANT_RESTORE_DRILL_PASS")
'
    ;;
  *)
    echo "::error::Unrecognized CI suite: $suite" >&2
    exit 2
    ;;
esac
