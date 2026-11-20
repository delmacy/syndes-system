#!/usr/bin/env bash
# Standalone disposable PG17 rehearsal of staged Control schema installation.
set -Eeuo pipefail
[[ "${SYNDES_DISPOSABLE_CONTROL_PG17:-}" == CI_ONLY ]] || exit 2
command -v docker >/dev/null || exit 3
root="$(cd "$(dirname "$0")/../.." && pwd)"
container="syndes-control-stage-ci-$RANDOM-$RANDOM"
cleanup(){ docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --rm --network none --name "$container" -e POSTGRES_PASSWORD=disposable-ci-only-password postgres:17-alpine >/dev/null
for n in $(seq 1 40); do
 docker exec "$container" pg_isready -U postgres -d postgres >/dev/null 2>&1 && break
 ((n<40)) || { echo 'CONTROL_PG17_NOT_READY';exit 4; }
 sleep 2
done
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c 'CREATE ROLE syndes_core NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE' >/dev/null
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c 'CREATE DATABASE syndes_staging_control' >/dev/null
files="control.schema control-iam-org-links.schema control-iam-org-provision-intents.schema control-signup-intents-candidate.schema control-signup-finalize-candidate.schema control-iam07d-revocation-receipts.schema control-iam07d-capabilities-010.schema"
for iteration in 1 2; do
  for filename in $files; do cat "$root/infra/postgres/bootstrap/$filename"; done |
    docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 --single-transaction -U postgres -d syndes_staging_control >/dev/null
done
count="$(docker exec "$container" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_staging_control -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
[[ "$count" =~ ^[0-9]+$ && "$count" -ge 9 ]] || exit 5
state="$(docker exec "$container" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_staging_control -c "SELECT CASE WHEN to_regclass('public.platform_iam07d_revocation_receipts') IS NOT NULL AND to_regclass('public.platform_signup_intents') IS NOT NULL AND EXISTS(SELECT 1 FROM pg_constraint WHERE conname='platform_iam07d_revocation_receipts_capability_v2_check' AND convalidated) THEN 'PASS' ELSE 'FAIL' END")"
[[ "$state" == PASS ]] || exit 5
echo 'MO_REL04_STAGE_CONTROL_PG17_TRANSACTION_REPLAY_PASS'
