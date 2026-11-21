#!/usr/bin/env bash
# Pre-alpha only: swap the NEW, never-used synthetic tenant with a fully rebuilt
# RFC4122-compatible tenant DB. Archive the old one: NEVER touch WhatsApp legacy.
# GitHub Actions only; stage proof MUST pass before operational DB swap.
set -Eeuo pipefail
umask 077
[[ "$#" == 3 && "$1" == apply && ("$2" == stage || "$2" == production) ]] || exit 2
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || exit 2
[[ "${SYNDES_GREENFIELD_REBUILD_APPROVAL:-}" == CI_APPROVED_UUID_MO_REL04 ]] || exit 2
[[ "${SYNDES_GREENFIELD_RELEASE_SHA:-}" =~ ^[0-9a-f]{40}$ ]] || exit 2
for app in docker stat sha256sum; do command -v "$app" >/dev/null || exit 3; done
mode="$2";bundle="$3"
[[ -d "$bundle" && ! -L "$bundle" && "$(stat -c %a "$bundle")" == 700 ]] || exit 3
cd "$bundle"
sha256sum --check --status MANIFEST.sha256 || { echo 'MO_REL04_UUID_BLOCKED=artifact_drift';exit 4; }
files=(
 001_account_hierarchy.sql
 002_legacy_single_context_gate.sql
 008_iam07d_revoke_first_candidate.sql
 001_crm_foundation.sql
 002_crm_tags_notes.sql
 003_crm_employees_channels.sql
 001_inbox_foundation.sql
 001_whatsapp_accounts.sql
 003_legacy_ownership.sql
 001_service_funnels.sql
 007_staff_roles_pre_release.sql
 002_service_team_transfer.sql
 003_service_conversation_inspector.sql
 006_context_creation_audit.sql
 009_iam_multiorg_fence_candidate.sql
 010_iam07d_cutover_capabilities_candidate.sql
 greenfield-pilot-seed.sql
)
for f in "${files[@]}";do [[ -f "$f" && ! -L "$f" ]] || exit 4;done
if [[ "$mode" == stage ]];then
 mapfile -t matches < <(docker ps -q --filter label=com.docker.compose.project=syndes-multiorg-staging --filter label=syndes.environment=multi-org-staging --filter label=syndes.component=control-postgres)
 control=syndes_staging_control;expected_image=postgres:17-alpine
else
 mapfile -t matches < <(docker ps -q --filter label=com.docker.compose.project=syndes-postgres --filter label=com.docker.compose.service=postgres)
 control=syndes_control;expected_image=postgres:17-bookworm
 [[ "$(docker inspect -f '{{.State.Running}}' syndes-whatsapp-whatsapp-gateway-1)" == true ]] || exit 4
fi
[[ "${#matches[@]}" == 1 ]] || { echo 'MO_REL04_UUID_BLOCKED=untrusted_pg';exit 4; }
pg="${matches[0]}"
[[ "$(docker inspect -f '{{.Config.Image}}' "$pg")" == "$expected_image" &&
  "$(docker inspect -f '{{.State.Running}}' "$pg")" == true ]] || exit 4
[[ "$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d postgres -c 'SHOW server_version_num')" =~ ^170[0-9]+$ ]] || exit 4
tid=1f5a8ce9-3f01-48cc-a013-2198d99e7510
compact="${tid//-/}"
canonical="syndes_tenant_$compact"
owner="syndes_t_$compact"
archive="syndes_greenfield_v1_$compact"
candidate="syndes_greenfield_v2_$compact"
[[ "${#archive}" -le 63 && "${#candidate}" -le 63 ]] || exit 4
state="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d "$control" -c "SELECT CASE WHEN
 (SELECT count(*) FROM public.tenant_registry WHERE tenant_id='$tid' AND database_name='$canonical' AND role_name='$owner' AND state='provisioned')=1
 AND NOT EXISTS(SELECT 1 FROM public.tenant_memberships WHERE tenant_id='$tid')
 AND (SELECT count(*) FROM pg_database WHERE datname='$canonical')=1
 AND (SELECT count(*) FROM pg_database WHERE datname IN ('$archive','$candidate'))=0
 AND NOT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname='$canonical' AND pid<>pg_backend_pid())
 THEN 'SAFE' ELSE 'BLOCKED' END")"
[[ "$state" == SAFE ]] || { echo 'MO_REL04_UUID_BLOCKED=control_or_db_busy';exit 4; }
role="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d postgres -c "SELECT rolcanlogin::text||':'||rolsuper::text||':'||rolcreatedb::text||':'||rolcreaterole::text FROM pg_roles WHERE rolname='$owner'")"
[[ "$role" == true:false:false:false ]] || { echo 'MO_REL04_UUID_BLOCKED=owner_privileges';exit 4; }
is_valid="^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
pre="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d "$canonical" -c "SELECT CASE WHEN
 (SELECT count(*) FROM platform_organizations WHERE tenant_id='$tid')=2
 AND (SELECT count(*) FROM platform_workspaces WHERE tenant_id='$tid')=4
 AND (SELECT count(*) FROM service.service_funnels WHERE tenant_id='$tid')=8
 AND (SELECT count(*) FROM service.service_funnel_stages WHERE tenant_id='$tid')=16
 AND (SELECT count(*) FROM service.service_funnels WHERE id::text !~ '$is_valid')=8
 AND (SELECT count(*) FROM service.service_attendances)=0
 AND (SELECT count(*) FROM service.service_attendance_events)=0
 AND (SELECT count(*) FROM public.platform_org_memberships)=0
 AND (SELECT count(*) FROM public.platform_workspace_memberships)=0
 AND (SELECT count(*) FROM whatsapp_accounts)=0
 AND (SELECT count(*) FROM inbox_conversations)=0
 THEN 'SYNTHETIC_ONLY' ELSE 'BLOCKED' END")"
[[ "$pre" == SYNTHETIC_ONLY ]] || { echo 'MO_REL04_UUID_BLOCKED=non_synthetic_or_already_repaired';exit 4; }
# Create and fully verify a SHADOW tenant database BEFORE touching the canonical.
docker exec "$pg" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres -c "CREATE DATABASE $candidate OWNER $owner" >/dev/null
{
 printf 'SET ROLE %s;\n' "$owner"
 cat 001_account_hierarchy.sql 002_legacy_single_context_gate.sql 008_iam07d_revoke_first_candidate.sql
 cat 001_crm_foundation.sql 002_crm_tags_notes.sql 003_crm_employees_channels.sql
 cat 001_inbox_foundation.sql 001_whatsapp_accounts.sql 003_legacy_ownership.sql
 printf '\nCREATE SCHEMA IF NOT EXISTS service;\n'
 cat 001_service_funnels.sql 007_staff_roles_pre_release.sql
 cat 002_service_team_transfer.sql 003_service_conversation_inspector.sql
 cat 006_context_creation_audit.sql
 printf '\nDROP INDEX platform_legacy_single_organization;\nDROP INDEX platform_legacy_single_workspace;\n'
 cat 009_iam_multiorg_fence_candidate.sql 010_iam07d_cutover_capabilities_candidate.sql
 cat greenfield-pilot-seed.sql
} | docker exec -i "$pg" psql --no-psqlrc -X -q -v ON_ERROR_STOP=1 --single-transaction -U postgres -d "$candidate" >/dev/null || {
 echo 'MO_REL04_UUID_BLOCKED=candidate_install';exit 5;
}
post="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d "$candidate" -c "SELECT CASE WHEN
 (SELECT count(*) FROM platform_organizations)=2
 AND (SELECT count(*) FROM platform_workspaces)=4
 AND (SELECT count(*) FROM service.service_funnels WHERE state='published')=8
 AND (SELECT count(*) FROM service.service_funnel_stages)=16
 AND NOT EXISTS(SELECT 1 FROM service.service_funnels WHERE id::text !~ '$is_valid')
 AND NOT EXISTS(SELECT 1 FROM service.service_funnel_stages WHERE id::text !~ '$is_valid')
 AND NOT EXISTS(SELECT 1 FROM whatsapp_accounts)
 AND NOT EXISTS(SELECT 1 FROM inbox_conversations)
 AND NOT EXISTS(SELECT 1 FROM pg_indexes WHERE indexname IN ('platform_legacy_single_organization','platform_legacy_single_workspace'))
 THEN 'VALID' ELSE 'BLOCKED' END")"
[[ "$post" == VALID ]] || { echo 'MO_REL04_UUID_BLOCKED=shadow_verification';exit 5; }
# External gate: NO sessions or founder; no alias to an operational tenant.
[[ "$(docker exec "$pg" psql -X -At -U postgres -d postgres -c "SELECT count(*) FROM pg_stat_activity WHERE datname='$canonical' AND pid<>pg_backend_pid()")" == 0 ]] || exit 5
docker exec "$pg" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres -c "ALTER DATABASE $canonical RENAME TO $archive" >/dev/null || {
 echo 'MO_REL04_UUID_BLOCKED=archive_rename';exit 6;
}
if ! docker exec "$pg" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres -c "ALTER DATABASE $candidate RENAME TO $canonical" >/dev/null; then
 # Best-effort recovery of the original canonical name, never destroy either DB.
 docker exec "$pg" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres -c "ALTER DATABASE $archive RENAME TO $canonical" >/dev/null 2>&1 || true
 echo 'MO_REL04_UUID_BLOCKED=canonical_rename';exit 6
fi
[[ "$(docker exec "$pg" psql -X -At -U postgres -d "$canonical" -c "SELECT count(*) FROM service.service_funnels WHERE id::text ~ '$is_valid'")" == 8 ]] || exit 6
[[ "$(docker exec "$pg" psql -X -At -U postgres -d postgres -c "SELECT count(*) FROM pg_database WHERE datname IN ('$canonical','$archive')")" == 2 ]] || exit 6
echo "MO_REL04_UUID_${mode^^}_NEW_TENANT_FUNNELS_RFC4122_PASS"
echo 'MO_REL04_UUID_OLD_SYNTHETIC_DATABASE_ARCHIVED_LEGACY_GATEWAY_UNTOUCHED'
