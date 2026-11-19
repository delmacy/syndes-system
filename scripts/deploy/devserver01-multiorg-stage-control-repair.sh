#!/usr/bin/env bash
# Single PURPOSE: recover a missing EMPTY Control DB in the already installed
# isolated multi-org staging PostgreSQL, only if the Keycloak DB+role are proven.
# Invoked only by an exact approved main-push GitHub Actions job after CI Gate.
# NEVER run on the operational Syndes PostgreSQL; no tenant data or permissions.
set -Eeuo pipefail
[[ "${1:-}" == repair && "$#" -eq 1 ]] || exit 2
[[ "${SYNDES_STAGE_CONTROL_REPAIR:-}" == 'CI_APPROVED_MO_REL04' ]] || exit 2
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || exit 2
command -v docker >/dev/null || exit 3
readonly project="syndes-multiorg-staging"
mapfile -t matches < <(docker ps -q \
 --filter "label=com.docker.compose.project=$project" \
 --filter "label=syndes.environment=multi-org-staging" \
 --filter "label=syndes.component=control-postgres")
[[ "${#matches[@]}" -eq 1 ]] || {
 echo 'MO_REL04_STAGING_CONTROL_REPAIR_DENY=unexpected_stage_pg';exit 4;
}
readonly cid="${matches[0]}"
[[ "$(docker inspect -f '{{.State.Running}}' "$cid")" == true ]] || exit 4
meta() {
 docker exec "$cid" psql --no-psqlrc -X -At -v ON_ERROR_STOP=1 \
   --username postgres --dbname postgres --command \
 "SELECT
  (SELECT count(*)::int FROM pg_database WHERE datname='syndes_staging_keycloak')::text||':'||
  (SELECT count(*)::int FROM pg_database WHERE datname='syndes_staging_control')::text||':'||
  (SELECT count(*)::int FROM pg_roles WHERE rolname='syndes_staging_keycloak')::text"
}
state="$(meta)" || { echo 'MO_REL04_STAGING_CONTROL_REPAIR_DENY=metadata_unavailable';exit 4; }
case "$state" in
 '1:1:1')
  echo 'MO_REL04_STAGING_CONTROL_DB_ALREADY_PRESENT'
  ;;
 '1:0:1')
  # Fixed reviewed identifier only, on the physically stage-labeled container.
  # Does not touch Keycloak DB or any application tenant.
  docker exec "$cid" psql --no-psqlrc -X -v ON_ERROR_STOP=1 \
   --username postgres --dbname postgres --command \
   'CREATE DATABASE syndes_staging_control' >/dev/null
  echo 'MO_REL04_STAGING_CONTROL_DB_CREATED'
  ;;
 *)
  echo "MO_REL04_STAGING_CONTROL_REPAIR_DENY=catalog_state_$state"
  exit 4
  ;;
esac
[[ "$(meta)" == '1:1:1' ]] || {
 echo 'MO_REL04_STAGING_CONTROL_REPAIR_DENY=postcondition';exit 4;
}
echo 'MO_REL04_STAGING_CONTROL_DB_CATALOG_PASS'
