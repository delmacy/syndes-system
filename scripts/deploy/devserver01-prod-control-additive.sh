#!/usr/bin/env bash
# One-shot additive Control schema promotion on the DevServer01 operational PG17.
# ONLY GitHub Actions main merge after the central CI Gate may invoke this.
# No SQL002 cutover, tenant database writes, Keycloak, FGA or Core runtime switch.
set -Eeuo pipefail
umask 077
[[ "$#" == 2 && "$1" == apply ]] || exit 2
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || exit 2
[[ "${SYNDES_PROD_CONTROL_RELEASE:-}" == CI_APPROVED_MO_REL08_ADDITIVE ]] || exit 2
[[ "${SYNDES_RELEASE_SHA:-}" =~ ^[0-9a-f]{40}$ ]] || exit 2
for exe in docker sha256sum pg_restore stat flock; do
 command -v "$exe" >/dev/null || {
   # pg_restore is run inside the disposable PostgreSQL image, not on host.
   [[ "$exe" == pg_restore ]] || exit 3
 }
done
bundle="$2"
[[ -d "$bundle" && ! -L "$bundle" && "$(stat -c %a "$bundle")" == 700 ]] || exit 3
cd "$bundle"
[[ -f MANIFEST.sha256 && ! -L MANIFEST.sha256 ]] || exit 3
sha256sum -c MANIFEST.sha256 --status || { echo 'MO_REL08_PROD_BLOCKED=artifact_checksum'; exit 4; }
for file in control-module-catalog.schema control-module-lifecycle.schema; do
 [[ -f "$file" && ! -L "$file" ]] || exit 4
done
# No stage/foreign/production identity inferred from a mutable cwd or secret.
mapfile -t matches < <(docker ps -q --filter label=com.docker.compose.project=syndes-postgres --filter label=com.docker.compose.service=postgres)
[[ "${#matches[@]}" == 1 ]] || { echo 'MO_REL08_PROD_BLOCKED=pg_identity'; exit 4; }
pg="${matches[0]}"
[[ "$(docker inspect -f '{{.State.Running}}' "$pg")" == true ]] || exit 4
[[ "$(docker inspect -f '{{.Config.Image}}' "$pg")" == postgres:17-bookworm ]] || exit 4
[[ "$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_control -c "SHOW server_version_num")" =~ ^170[0-9]+$ ]] || {
 echo 'MO_REL08_PROD_BLOCKED=pg_version'; exit 4;
}
core_role="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d postgres -c "SELECT rolcanlogin::text||':'||rolsuper::text||':'||rolcreatedb::text||':'||rolcreaterole::text FROM pg_roles WHERE rolname='syndes_core'")"
[[ "$core_role" == true:false:false:false ]] || { echo 'MO_REL08_PROD_BLOCKED=core_role'; exit 4; }
base="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_control -c "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('tenant_registry','tenant_memberships','platform_operator_access','platform_tenant_profiles')")"
[[ "$base" == 4 ]] || { echo 'MO_REL08_PROD_BLOCKED=control_baseline'; exit 4; }
tenants_before="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_control -c "SELECT count(*) FROM public.tenant_registry")"
[[ "$tenants_before" =~ ^[0-9]+$ && "$tenants_before" -ge 1 ]] || exit 4
module_tables="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_control -c "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('module_catalog','module_catalog_versions','module_catalog_dependencies','tenant_module_entitlements','tenant_module_installs','tenant_module_audit')")"
[[ "$module_tables" == 0 || "$module_tables" == 6 ]] || { echo 'MO_REL08_PROD_BLOCKED=partial_module_schema';exit 4; }
backup_root=/home/delmacy/.local/share/syndes-prod-control-releases
if [[ -e "$backup_root" || -L "$backup_root" ]]; then
 [[ -d "$backup_root" && ! -L "$backup_root" && "$(stat -c %a "$backup_root")" == 700 ]] || exit 4
else
 mkdir -m 0700 "$backup_root"
fi
exec 9>"$backup_root/.schema-release.lock"
flock -n 9 || { echo 'MO_REL08_PROD_BLOCKED=another_release';exit 4; }
if [[ "$module_tables" == 6 ]]; then
 # Intentionally never re-run operator functions on operational data.
 echo 'MO_REL08_PROD_CONTROL_CATALOG_ALREADY_INSTALLED_NO_MULTI_ORG_CUTOVER'
 exit 0
fi
release="$backup_root/$SYNDES_RELEASE_SHA"
[[ ! -L "$release" ]] || exit 4
mkdir -p -m 0700 "$release"
[[ "$(stat -c %a "$release")" == 700 ]] || exit 4
backup="$release/control-before-catalog.dump"
[[ ! -e "$backup" && ! -L "$backup" ]] || { echo 'MO_REL08_PROD_BLOCKED=backup_already_exists_no_replay';exit 4; }
tmp="$release/.control-backup-$$"
trap 'rm -f "$tmp"' EXIT
# The entire operational Control database is captured before any DDL.
docker exec "$pg" pg_dump -Fc -U postgres -d syndes_control > "$tmp" || {
 echo 'MO_REL08_PROD_BLOCKED=pg_dump'; exit 5;
}
[[ -s "$tmp" ]] || exit 5
chmod 0600 "$tmp"
mv -n "$tmp" "$backup"
[[ ! -e "$tmp" && -f "$backup" && ! -L "$backup" ]] || exit 5
sha256sum "$backup" | awk '{print $1}' > "$release/control-before-catalog.sha256"
chmod 0600 "$release/control-before-catalog.sha256"
# Restore into a throwaway PostgreSQL with NO network, volumes or host ports.
# This checks the actual live snapshot + exact proposed DDL, not a fake unit fixture.
verifier="syndes-prod-control-verify-${SYNDES_RELEASE_SHA:0:12}"
[[ -z "$(docker ps -aq --filter "name=^/${verifier}$")" ]] || {
 echo 'MO_REL08_PROD_BLOCKED=disposable_name_collision';exit 5;
}
verifier_id=''
cleanup() {
 [[ -z "$verifier_id" ]] || docker rm -f "$verifier_id" >/dev/null 2>&1 || true
 rm -f "$tmp"
}
trap cleanup EXIT
verifier_id="$(docker run -d --rm --network none --name "$verifier" -e POSTGRES_PASSWORD=synthetic-ci-only postgres:17-alpine)"
[[ -n "$verifier_id" ]] || exit 5
for i in $(seq 1 40); do
 docker exec "$verifier_id" pg_isready -U postgres -d postgres >/dev/null 2>&1 && break
 [[ "$i" -lt 40 ]] || { echo 'MO_REL08_PROD_BLOCKED=restore_pg_ready';exit 5; }
 sleep 2
done
docker exec "$verifier_id" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres -c "CREATE ROLE syndes_core NOLOGIN" >/dev/null
docker exec "$verifier_id" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres -c "CREATE DATABASE syndes_control" >/dev/null
docker exec -i "$verifier_id" pg_restore --no-owner --no-privileges -U postgres -d syndes_control < "$backup" || {
 echo 'MO_REL08_PROD_BLOCKED=restore_failed';exit 5;
}
restored="$(docker exec "$verifier_id" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_control -c "SELECT count(*) FROM public.tenant_registry")"
[[ "$restored" == "$tenants_before" ]] || { echo 'MO_REL08_PROD_BLOCKED=restore_mismatch';exit 5; }
for n in 1 2; do
 cat control-module-catalog.schema control-module-lifecycle.schema |
 docker exec -i "$verifier_id" psql -X -q -v ON_ERROR_STOP=1 --single-transaction -U postgres -d syndes_control >/dev/null || {
 echo 'MO_REL08_PROD_BLOCKED=disposable_sql';exit 5;
 }
done
clone_tables="$(docker exec "$verifier_id" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_control -c "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('module_catalog','module_catalog_versions','module_catalog_dependencies','tenant_module_entitlements','tenant_module_installs','tenant_module_audit')")"
[[ "$clone_tables" == 6 ]] || { echo 'MO_REL08_PROD_BLOCKED=disposable_verify';exit 5; }
echo 'MO_REL08_PROD_CONTROL_REAL_BACKUP_RESTORE_AND_MIGRATION_REPLAY_PASS'
# Recheck live target after backup/restore drill to deny concurrent baseline changes.
live_now="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_control -c "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('module_catalog','module_catalog_versions','module_catalog_dependencies','tenant_module_entitlements','tenant_module_installs','tenant_module_audit')")"
[[ "$live_now" == 0 ]] || { echo 'MO_REL08_PROD_BLOCKED=concurrent_schema';exit 5; }
[[ "$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_control -c "SELECT count(*) FROM public.tenant_registry")" == "$tenants_before" ]] || {
 echo 'MO_REL08_PROD_BLOCKED=concurrent_tenant_registry';exit 5;
}
cat control-module-catalog.schema control-module-lifecycle.schema |
 docker exec -i "$pg" psql -X -q -v ON_ERROR_STOP=1 --single-transaction -U postgres -d syndes_control >/dev/null || {
 echo 'MO_REL08_PROD_BLOCKED=live_transaction';exit 6;
}
final="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_control -c "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('module_catalog','module_catalog_versions','module_catalog_dependencies','tenant_module_entitlements','tenant_module_installs','tenant_module_audit')")"
[[ "$final" == 6 ]] || { echo 'MO_REL08_PROD_BLOCKED=live_postcondition';exit 6; }
grant_count="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_control -c "SELECT count(*) FROM public.tenant_module_entitlements WHERE state='granted'")"
[[ "$grant_count" == 0 ]] || { echo 'MO_REL08_PROD_BLOCKED=unexpected_grant';exit 6; }
[[ "$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_control -c "SELECT count(*) FROM public.tenant_registry")" == "$tenants_before" ]] || exit 6
echo 'MO_REL08_PROD_CONTROL_ADDITIVE_CATALOG_LIFECYCLE_APPLIED_NO_TENANT_OR_AUTH_SWITCH'
