#!/usr/bin/env bash
# Greenfield multi-org prototype on isolated DevServer01 staging PG17.
# NEVER the operational syndes-postgres DB, any existing tenant, or WhatsApp gateway.
set -Eeuo pipefail
umask 077
[[ "$#" == 2 && "$1" == apply ]] || exit 2
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || exit 2
[[ "${SYNDES_GREENFIELD_PILOT_APPROVAL:-}" == CI_APPROVED_GREENFIELD_MO ]] || exit 2
[[ "${SYNDES_GREENFIELD_MAIN_SHA:-}" =~ ^[a-f0-9]{40}$ ]] || exit 2
for command in docker python3 sha256sum openssl stat; do command -v "$command" >/dev/null || exit 3; done
root=/home/delmacy/.local/share/syndes-multiorg-staging
[[ -d "$root" && ! -L "$root" && "$(stat -c %a "$root")" == 700 ]] || exit 3
[[ -d "$root/secrets" && ! -L "$root/secrets" && "$(stat -c %a "$root/secrets")" == 700 ]] || exit 3
bundle="$2"
[[ -d "$bundle" && ! -L "$bundle" && "$(stat -c %a "$bundle")" == 700 ]] || exit 3
cd "$bundle"
sha256sum -c MANIFEST.sha256 --status || { echo 'MO_GREENFIELD_BLOCKED=source_digest';exit 4; }
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
for file in "${files[@]}"; do [[ -f "$file" && ! -L "$file" ]] || exit 4; done
project=syndes-multiorg-staging
one() {
 local component="$1" cid
 local -a matches
 mapfile -t matches < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter label=syndes.environment=multi-org-staging --filter "label=syndes.component=$component")
 [[ "${#matches[@]}" == 1 ]] || { echo "MO_GREENFIELD_BLOCKED=missing_$component";return 4; }
 cid="${matches[0]}"
 [[ "$(docker inspect -f '{{.State.Running}}' "$cid")" == true ]] || return 4
 printf '%s\n' "$cid"
}
pg="$(one control-postgres)" || exit 4
fga="$(one openfga)" || exit 4
one keycloak >/dev/null || exit 4
[[ "$(docker inspect -f '{{.Config.Image}}' "$pg")" == postgres:17-alpine ]] || exit 4
[[ "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/openfga/config.yaml"}}durable{{end}}{{end}}' "$fga")" == durable ]] || exit 4
[[ "$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d postgres -c 'SHOW server_version_num')" =~ ^170[0-9]+$ ]] || exit 4
control_ready="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_staging_control -c "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('tenant_registry','platform_keycloak_org_links','module_catalog','tenant_module_installs')")"
[[ "$control_ready" == 4 ]] || { echo 'MO_GREENFIELD_BLOCKED=control_baseline';exit 4; }
tid=1f5a8ce9-3f01-48cc-a013-2198d99e7510
compact="${tid//-/}"
db="syndes_tenant_$compact"
role="syndes_t_$compact"
secret="$root/secrets/greenfield-pilot-tenant-db"
if [[ ! -e "$secret" && ! -L "$secret" ]]; then
 tmp="$(mktemp "$root/secrets/.greenfield-password.XXXXXXXX")"
 openssl rand -hex 32 > "$tmp"
 chmod 0600 "$tmp"
 mv -n "$tmp" "$secret"
 [[ ! -e "$tmp" ]] || { rm -f "$tmp";exit 4; }
fi
[[ -f "$secret" && ! -L "$secret" && "$(stat -c %a "$secret")" == 600 ]] || exit 4
password="$(cat "$secret")"
[[ "$password" =~ ^[a-f0-9]{64}$ ]] || exit 4
state="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d postgres -c "SELECT (SELECT count(*) FROM pg_roles WHERE rolname='$role')::text||':'||(SELECT count(*) FROM pg_database WHERE datname='$db')::text")"
if [[ "$state" == 0:0 ]]; then
 {
   printf '\\set pilot_password %s\n' "$password"
   printf "SELECT format('CREATE ROLE %%I LOGIN PASSWORD %%L NOSUPERUSER NOCREATEDB NOCREATEROLE', '%s', :'pilot_password') \\gexec\n" "$role"
   printf 'CREATE DATABASE %s OWNER %s;\n' "$db" "$role"
   printf 'REVOKE CONNECT ON DATABASE %s FROM PUBLIC;\n' "$db"
   printf 'GRANT CONNECT ON DATABASE %s TO %s;\n' "$db" "$role"
 } | docker exec -i "$pg" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres >/dev/null
elif [[ "$state" != 1:1 ]]; then
 echo 'MO_GREENFIELD_BLOCKED=partial_db_role';exit 4
fi
unset password
role_ok="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d postgres -c "SELECT rolcanlogin::text||':'||rolsuper::text||':'||rolcreatedb::text||':'||rolcreaterole::text FROM pg_roles WHERE rolname='$role'")"
[[ "$role_ok" == true:false:false:false ]] || { echo 'MO_GREENFIELD_BLOCKED=role_privileges';exit 4; }
verify_tenant() {
 docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d "$db" -c "
 SELECT CASE WHEN
  (SELECT count(*) FROM public.platform_organizations WHERE tenant_id='$tid')=2 AND
  (SELECT count(*) FROM public.platform_workspaces WHERE tenant_id='$tid')=4 AND
  (SELECT count(*) FROM service.service_funnels WHERE tenant_id='$tid' AND state='published')=8 AND
  (SELECT count(*) FROM service.service_funnel_stages WHERE tenant_id='$tid')=16 AND
  (SELECT count(*) FROM public.whatsapp_accounts)=0 AND
  (SELECT count(*) FROM public.inbox_conversations)=0 AND
  (SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname IN ('platform_legacy_single_organization','platform_legacy_single_workspace'))=0
 THEN 'PASS' ELSE 'FAIL' END" 2>/dev/null || true
}
tables="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d "$db" -c "SELECT count(*) FROM pg_tables WHERE schemaname='public'")"
[[ "$tables" =~ ^[0-9]+$ ]] || exit 4
if (( tables > 0 )); then
 [[ "$(verify_tenant)" == PASS ]] || { echo 'MO_GREENFIELD_BLOCKED=partial_tenant_schema';exit 4; }
else
 # New database, no customer records: install the reviewed module SQL as
 # owner, remove both legacy barriers TOGETHER, and seed real scoped rows.
 {
   printf 'SET ROLE %s;\n' "$role"
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
 } | docker exec -i "$pg" psql --no-psqlrc -X -q -v ON_ERROR_STOP=1 --single-transaction -U postgres -d "$db" >/dev/null || {
 echo 'MO_GREENFIELD_BLOCKED=transaction_failed';exit 5;
 }
fi
[[ "$(verify_tenant)" == PASS ]] || { echo 'MO_GREENFIELD_BLOCKED=postcondition';exit 5; }
registry="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_staging_control -c "SELECT count(*) FROM public.tenant_registry WHERE tenant_id='$tid' AND database_name='$db' AND role_name='$role' AND state='provisioned'")"
if [[ "$registry" == 0 ]]; then
 # Admission stays fail-closed until real Keycloak/FGA and signup reconciliation.
 docker exec "$pg" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d syndes_staging_control -c "INSERT INTO public.tenant_registry(tenant_id,database_name,role_name,state) VALUES('$tid','$db','$role','provisioned') ON CONFLICT(tenant_id) DO NOTHING" >/dev/null
fi
[[ "$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_staging_control -c "SELECT count(*) FROM public.tenant_registry WHERE tenant_id='$tid' AND database_name='$db' AND role_name='$role' AND state='provisioned'")" == 1 ]] || {
 echo 'MO_GREENFIELD_BLOCKED=control_mapping';exit 5;
}
echo 'MO_GREENFIELD_REAL_PG17_NEW_TENANT_TWO_ORGS_FOUR_WS_EIGHT_FUNNELS_PASS'
echo 'MO_GREENFIELD_NO_WHATSAPP_GATEWAY_CHANGE_AND_NO_LEGACY_SQL002_CUTOVER'
echo 'MO_GREENFIELD_CONTROL_PROVISIONED_NOT_KC_FGA_OR_CORE_RELEASED'
