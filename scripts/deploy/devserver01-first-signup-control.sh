#!/usr/bin/env bash
# Mainline CI-only first-signup Control migration: stage, then operational PG17.
# No existing tenant DB, WhatsApp gateway, identity realm or grants are touched.
set -Eeuo pipefail
umask 077
[[ "$#" == 3 && "$1" == apply && ("$2" == stage || "$2" == production) ]] || exit 2
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || exit 2
[[ "${SYNDES_SIGNUP_LINK_RELEASE:-}" == CI_APPROVED_FIRST_SIGNUP ]] || exit 2
[[ "${SYNDES_SIGNUP_RELEASE_SHA:-}" =~ ^[a-f0-9]{40}$ ]] || exit 2
for command in docker sha256sum stat; do command -v "$command" >/dev/null || exit 3; done
mode="$2"
bundle="$3"
[[ -d "$bundle" && ! -L "$bundle" && "$(stat -c %a "$bundle")" == 700 ]] || exit 3
cd "$bundle"
sha256sum --check --status MANIFEST.sha256 || { echo 'UC_SIGNUP01C_BLOCKED=artifact_checksum';exit 4; }
files=(control-iam-org-links.schema control-signup-intents-candidate.schema
 control-signup-finalize-candidate.schema control-signup-initial-link-candidate.schema)
for file in "${files[@]}"; do [[ -f "$file" && ! -L "$file" ]] || exit 4;done
if [[ "$mode" == stage ]]; then
 mapfile -t found < <(docker ps -q --filter label=com.docker.compose.project=syndes-multiorg-staging --filter label=syndes.environment=multi-org-staging --filter label=syndes.component=control-postgres)
 db=syndes_staging_control
 image=postgres:17-alpine
else
 mapfile -t found < <(docker ps -q --filter label=com.docker.compose.project=syndes-postgres --filter label=com.docker.compose.service=postgres)
 db=syndes_control
 image=postgres:17-bookworm
fi
[[ "${#found[@]}" == 1 ]] || { echo 'UC_SIGNUP01C_BLOCKED=untrusted_pg';exit 4; }
pg="${found[0]}"
[[ "$(docker inspect -f '{{.Config.Image}}' "$pg")" == "$image" &&
    "$(docker inspect -f '{{.State.Running}}' "$pg")" == true ]] || exit 4
[[ "$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d "$db" -c 'SHOW server_version_num')" =~ ^170[0-9]+$ ]] || exit 4
base="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d "$db" -c "SELECT CASE WHEN
 to_regclass('public.tenant_registry') IS NOT NULL
 AND to_regclass('public.tenant_memberships') IS NOT NULL
 AND to_regclass('public.module_catalog') IS NOT NULL
 AND EXISTS(SELECT 1 FROM public.tenant_registry
   WHERE tenant_id='1f5a8ce9-3f01-48cc-a013-2198d99e7510'
     AND state='provisioned')
 THEN 'READY' ELSE 'BLOCKED' END")"
[[ "$base" == READY ]] || { echo 'UC_SIGNUP01C_BLOCKED=missing_greenfield_control';exit 4; }
count="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d "$db" -c "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('platform_keycloak_org_links','platform_keycloak_org_link_audit','platform_signup_intents','platform_signup_intent_audit')")"
[[ "$count" == 0 || "$count" == 4 ]] || { echo 'UC_SIGNUP01C_BLOCKED=partial_control_schema';exit 4; }
if [[ "$mode" == stage ]];then
 [[ "$count" == 4 ]] || { echo 'UC_SIGNUP01C_BLOCKED=stage_baseline';exit 4; }
else
 # Greenfield production was deliberately installed without signup schemas.
 # If another actor already created them, verify exact expected state below.
 [[ "$count" == 0 || "$count" == 4 ]] || exit 4
fi
control_count="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d "$db" -c 'SELECT count(*) FROM public.tenant_registry')"
# Migrations use DDL only; runtime tenant registry and memberships remain unchanged.
if [[ "$mode" == stage ]]; then
 cat control-signup-initial-link-candidate.schema |
  docker exec -i "$pg" psql --no-psqlrc -X -q -v ON_ERROR_STOP=1 --single-transaction -U postgres -d "$db" >/dev/null || exit 5
else
 # Install role, reserved intents, audited link, and finalizer as one transaction.
 cat "${files[@]}" |
  docker exec -i "$pg" psql --no-psqlrc -X -q -v ON_ERROR_STOP=1 --single-transaction -U postgres -d "$db" >/dev/null || exit 5
fi
verify="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d "$db" -c "SELECT CASE WHEN
 (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('platform_keycloak_org_links','platform_keycloak_org_link_audit','platform_signup_intents','platform_signup_intent_audit'))=4
 AND to_regprocedure('public.platform_signup_bind_initial_keycloak_org(uuid,text,uuid,uuid)') IS NOT NULL
 AND to_regprocedure('public.platform_signup_finalize(uuid,uuid,uuid)') IS NOT NULL
 AND has_function_privilege('syndes_signup_link_operator','public.platform_signup_bind_initial_keycloak_org(uuid,text,uuid,uuid)','EXECUTE')
 AND NOT has_function_privilege('syndes_core','public.platform_signup_bind_initial_keycloak_org(uuid,text,uuid,uuid)','EXECUTE')
 AND NOT has_table_privilege('syndes_signup_link_operator','public.platform_keycloak_org_links','INSERT')
 AND NOT EXISTS(SELECT 1 FROM public.platform_keycloak_org_links)
 AND EXISTS(SELECT 1 FROM public.tenant_registry WHERE tenant_id='1f5a8ce9-3f01-48cc-a013-2198d99e7510' AND state='provisioned')
 THEN 'PASS' ELSE 'FAIL' END")"
[[ "$verify" == PASS ]] || { echo 'UC_SIGNUP01C_BLOCKED=invalid_live_schema_or_early_link';exit 5; }
[[ "$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d "$db" -c 'SELECT count(*) FROM public.tenant_registry')" == "$control_count" ]] || exit 5
echo "UC_SIGNUP01C_${mode^^}_CONTROL_INITIAL_KC_LINK_OPERATOR_INSTALLED_NO_USER_GRANTS"
