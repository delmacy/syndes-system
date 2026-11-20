#!/usr/bin/env bash
# CI-only Control staging bootstrap; no production, user tenant or runtime execution.
set -Eeuo pipefail
umask 077
[[ "$#" == 2 && "$1" == apply ]] || exit 2
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || exit 2
[[ "$SYNDES_STAGE_CONTROL_APPROVAL" == CI_APPROVED_MO_REL04 ]] || exit 2
bundle="$2"
[[ -d "$bundle" && ! -L "$bundle" && "$(stat -c %a "$bundle")" == 700 ]] || exit 3
cd "$bundle"
sha256sum --check --status MANIFEST.sha256 || { echo 'MO_REL04_CONTROL_BLOCKED=artifact_digest'; exit 4; }
files="control.schema control-iam-org-links.schema control-iam-org-provision-intents.schema control-signup-intents-candidate.schema control-signup-finalize-candidate.schema control-iam07d-revocation-receipts.schema control-iam07d-capabilities-010.schema"
for file in $files; do [[ -f "$file" && ! -L "$file" ]] || exit 4; done
one() {
 local component="$1" cid
 local -a matches
 mapfile -t matches < <(docker ps -q --filter label=com.docker.compose.project=syndes-multiorg-staging --filter label=syndes.environment=multi-org-staging --filter "label=syndes.component=$component")
 [[ "${#matches[@]}" == 1 ]] || { echo "MO_REL04_CONTROL_BLOCKED=$component"; return 4; }
 cid="${matches[0]}"
 [[ "$(docker inspect -f '{{.State.Running}}' "$cid")" == true ]] || return 4
 printf '%s\n' "$cid"
}
pg="$(one control-postgres)" || exit 4
fga="$(one openfga)" || exit 4
one keycloak >/dev/null || exit 4
[[ "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/openfga/config.yaml"}}persisted{{end}}{{end}}' "$fga")" == persisted ]] || {
 echo 'MO_REL04_CONTROL_BLOCKED=fga_not_persistent';exit 4;
}
tables="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_staging_control -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")" || exit 4
[[ "$tables" =~ ^[0-9]+$ ]] || exit 4
verify() {
 docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_staging_control -c "SELECT CASE WHEN
 to_regclass('public.tenant_registry') IS NOT NULL
 AND to_regclass('public.platform_keycloak_org_links') IS NOT NULL
 AND to_regclass('public.platform_iam_org_provision_intents') IS NOT NULL
 AND to_regclass('public.platform_signup_intents') IS NOT NULL
 AND to_regclass('public.platform_iam07d_revocation_receipts') IS NOT NULL
 AND EXISTS(SELECT 1 FROM pg_constraint WHERE conname='platform_iam07d_revocation_receipts_capability_v2_check' AND convalidated)
 THEN 'INSTALLED' ELSE 'INCOMPLETE' END"
}
if (( tables > 0 )); then
 [[ "$(verify)" == INSTALLED ]] || { echo 'MO_REL04_CONTROL_BLOCKED=partial_schema'; exit 4; }
 echo 'MO_REL04_CONTROL_ALREADY_INSTALLED_VERIFIED'; exit 0
fi
role="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d postgres -c "SELECT COALESCE((SELECT rolcanlogin::text||':'||rolsuper::text FROM pg_roles WHERE rolname='syndes_core'),'absent')")"
[[ "$role" == absent || "$role" == 'false:false' ]] || {
 echo 'MO_REL04_CONTROL_BLOCKED=existing_core_role_privileges';exit 4;
}
if [[ "$role" == absent ]]; then
 docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d postgres -c "CREATE ROLE syndes_core NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE" >/dev/null
fi
# Only stage-owned SQL is applied. One transaction, fail closed on partial state.
cat $files | docker exec -i "$pg" psql --no-psqlrc -X -q -v ON_ERROR_STOP=1 --single-transaction -U postgres -d syndes_staging_control >/dev/null || {
 echo 'MO_REL04_CONTROL_BLOCKED=transaction_failed';exit 5;
}
[[ "$(verify)" == INSTALLED ]] || { echo 'MO_REL04_CONTROL_BLOCKED=verification';exit 5; }
echo 'MO_REL04_CONTROL_STAGE_INITIAL_SCHEMAS_TRANSACTIONAL_PASS_NOT_CORE_E2E'
