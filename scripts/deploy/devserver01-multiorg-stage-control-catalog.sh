#!/usr/bin/env bash
# CI-only second Control migration batch on isolated DevServer01 staging.
set -Eeuo pipefail
umask 077
[[ "$#" == 2 && "$1" == apply ]] || exit 2
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || exit 2
[[ "${SYNDES_STAGE_CATALOG_APPROVAL:-}" == CI_APPROVED_MO_REL04 ]] || exit 2
bundle="$2"
[[ -d "$bundle" && ! -L "$bundle" && "$(stat -c %a "$bundle")" == 700 ]] || exit 3
cd "$bundle"
sha256sum --check --status MANIFEST.sha256 || { echo 'MO_REL04_CATALOG_BLOCKED=sha_drift'; exit 4; }
for name in control-module-catalog.schema control-module-lifecycle.schema; do
 [[ -f "$name" && ! -L "$name" ]] || exit 4
done
one(){
 local component="$1" cid
 local -a matches
 mapfile -t matches < <(docker ps -q --filter label=com.docker.compose.project=syndes-multiorg-staging --filter label=syndes.environment=multi-org-staging --filter "label=syndes.component=$component")
 [[ "${#matches[@]}" == 1 ]] || { echo "MO_REL04_CATALOG_BLOCKED=$component";return 4; }
 cid="${matches[0]}"
 [[ "$(docker inspect -f '{{.State.Running}}' "$cid")" == true ]] || return 4
 printf '%s\n' "$cid"
}
pg="$(one control-postgres)" || exit 4
fga="$(one openfga)" || exit 4
one keycloak >/dev/null || exit 4
[[ "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/openfga/config.yaml"}}postgres{{end}}{{end}}' "$fga")" == postgres ]] || exit 4
base="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_staging_control -c "SELECT CASE WHEN to_regclass('public.tenant_registry') IS NOT NULL AND to_regclass('public.platform_keycloak_org_links') IS NOT NULL AND to_regclass('public.platform_signup_intents') IS NOT NULL AND to_regclass('public.platform_iam07d_revocation_receipts') IS NOT NULL THEN 'READY' ELSE 'BLOCKED' END")" || exit 4
[[ "$base" == READY ]] || { echo 'MO_REL04_CATALOG_BLOCKED=base_control';exit 4; }
role="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d postgres -c "SELECT COALESCE((SELECT rolcanlogin::text||':'||rolsuper::text FROM pg_roles WHERE rolname='syndes_core'),'missing')")"
[[ "$role" == false:false ]] || { echo 'MO_REL04_CATALOG_BLOCKED=core_role';exit 4; }
count="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_staging_control -c "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('module_catalog','module_catalog_versions','module_catalog_dependencies','tenant_module_entitlements','tenant_module_installs','tenant_module_audit')")"
[[ "$count" == 0 || "$count" == 6 ]] || { echo 'MO_REL04_CATALOG_BLOCKED=partial_module_schema';exit 4; }
if [[ "$count" == 6 ]]; then
 echo 'MO_REL04_STAGE_CATALOG_ALREADY_INSTALLED';exit 0
fi
cat control-module-catalog.schema control-module-lifecycle.schema |
 docker exec -i "$pg" psql --no-psqlrc -X -q -v ON_ERROR_STOP=1 --single-transaction -U postgres -d syndes_staging_control >/dev/null || {
 echo 'MO_REL04_CATALOG_BLOCKED=sql_transaction';exit 5;
}
verified="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_staging_control -c "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('module_catalog','module_catalog_versions','module_catalog_dependencies','tenant_module_entitlements','tenant_module_installs','tenant_module_audit')")"
[[ "$verified" == 6 ]] || { echo 'MO_REL04_CATALOG_BLOCKED=postcondition';exit 5; }
echo 'MO_REL04_STAGE_CONTROL_MODULE_CATALOG_LIFECYCLE_PG17_PASS_NO_ENTITLEMENT_GRANTS'
