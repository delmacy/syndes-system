#!/usr/bin/env bash
# Real isolated PostgreSQL 17: legacy SQL002 preserved, new multi-org database.
set -Eeuo pipefail
[[ "${SYNDES_GREENFIELD_DISPOSABLE:-}" == CI_ONLY ]] || exit 2
command -v docker >/dev/null || exit 3
root="$(cd "$(dirname "$0")/../.." && pwd)"
container="syndes-greenfield-ci-$RANDOM-$RANDOM"
cleanup(){ docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --rm --network none --name "$container" -e POSTGRES_PASSWORD=ci-only-synthetic postgres:17-alpine >/dev/null
for i in $(seq 1 50); do
 if docker exec "$container" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d postgres -c 'SELECT 1' 2>/dev/null | grep -qx 1; then break; fi
 (( i<50 )) || { echo 'MO_GREENFIELD_CI_POSTGRES_NOT_READY';exit 4; }
 sleep 2
done
docker exec "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres -c 'CREATE ROLE syndes_greenfield_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE' >/dev/null
docker exec "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres -c 'CREATE DATABASE syndes_ci_legacy' >/dev/null
docker exec "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres -c 'CREATE DATABASE syndes_ci_fresh OWNER syndes_greenfield_owner' >/dev/null
cat "$root/modules/organizations/sql/001_account_hierarchy.sql" \
    "$root/modules/organizations/sql/002_legacy_single_context_gate.sql" |
 docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 --single-transaction -U postgres -d syndes_ci_legacy >/dev/null
{
 echo 'SET ROLE syndes_greenfield_owner;'
 cat "$root/modules/organizations/sql/001_account_hierarchy.sql"
 cat "$root/modules/organizations/sql/002_legacy_single_context_gate.sql"
 cat "$root/modules/organizations/sql/008_iam07d_revoke_first_candidate.sql"
 cat "$root/modules/core-crm/sql/001_crm_foundation.sql"
 cat "$root/modules/core-crm/sql/002_crm_tags_notes.sql"
 cat "$root/modules/core-crm/sql/003_crm_employees_channels.sql"
 cat "$root/modules/inbox/sql/001_inbox_foundation.sql"
 cat "$root/modules/whatsapp/sql/001_whatsapp_accounts.sql"
 cat "$root/modules/organizations/sql/003_legacy_ownership.sql"
 echo 'CREATE SCHEMA IF NOT EXISTS service;'
 cat "$root/modules/service-management/sql/001_service_funnels.sql"
 cat "$root/modules/organizations/sql/007_staff_roles_pre_release.sql"
 cat "$root/modules/service-management/sql/002_service_team_transfer.sql"
 cat "$root/modules/service-management/sql/003_service_conversation_inspector.sql"
 cat "$root/modules/organizations/sql/006_context_creation_audit.sql"
 printf 'DROP INDEX platform_legacy_single_organization;\nDROP INDEX platform_legacy_single_workspace;\n'
 cat "$root/modules/organizations/sql/009_iam_multiorg_fence_candidate.sql"
 cat "$root/modules/organizations/sql/010_iam07d_cutover_capabilities_candidate.sql"
 cat "$root/infra/multiorg-staging/greenfield-pilot-seed.sql"
} | docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 --single-transaction -U postgres -d syndes_ci_fresh >/dev/null
legacy="$(docker exec "$container" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_ci_legacy -c "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname IN ('platform_legacy_single_organization','platform_legacy_single_workspace')")"
fresh="$(docker exec "$container" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_ci_fresh -c "SELECT (SELECT count(*) FROM platform_organizations)::text||':'||(SELECT count(*) FROM platform_workspaces)::text||':'||(SELECT count(*) FROM service.service_funnels WHERE state='published')::text||':'||(SELECT count(*) FROM whatsapp_accounts)::text")"
new_barriers="$(docker exec "$container" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_ci_fresh -c "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname IN ('platform_legacy_single_organization','platform_legacy_single_workspace')")"
[[ "$legacy" == 2 && "$new_barriers" == 0 && "$fresh" == '2:4:8:0' ]] || exit 5
valid_ids="$(docker exec "$container" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_ci_fresh -c "
SELECT (SELECT count(*) FROM service.service_funnels WHERE id::text ~
 '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')::text
 || ':' || (SELECT count(*) FROM service.service_funnel_stages WHERE id::text ~
 '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')::text")"
[[ "$valid_ids" == 8:16 ]] || { echo 'MO_GREENFIELD_CI_BLOCKED=non_rfc4122_funnel_ids';exit 5; }
echo 'MO_GREENFIELD_PG17_FINE_AUTHZ_VALID_UUIDS_8_FUNNELS_16_STAGES_PASS'
echo 'MO_GREENFIELD_PG17_TWO_ORGS_FOUR_WORKSPACES_EIGHT_FUNNELS_PASS'
echo 'MO_GREENFIELD_LEGACY_SQL002_UNCHANGED_AND_WHATSAPP_EMPTY_PASS'
