#!/usr/bin/env bash
# MO-REL-04: recover a FIRST-BOOT-INCOMPLETE, otherwise EMPTY isolated staging
# PG17 catalog. No dropping databases, no production membership, no grants.
# Only callable from one-shot GitHub Actions main merge AFTER Syndes CI Gate.
set -Eeuo pipefail
[[ "${1:-}" == bootstrap && "$#" -eq 1 ]] || exit 2
[[ "${SYNDES_STAGE_PG_BOOTSTRAP:-}" == 'CI_APPROVED_MO_REL04' ]] || exit 2
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || exit 2
[[ "${SYNDES_STAGE_INIT_SHA256:-}" =~ ^[0-9a-f]{64}$ ]] || exit 2
command -v docker >/dev/null || exit 3
readonly project='syndes-multiorg-staging'
mapfile -t matches < <(docker ps -q \
 --filter "label=com.docker.compose.project=$project" \
 --filter 'label=syndes.environment=multi-org-staging' \
 --filter 'label=syndes.component=control-postgres')
[[ "${#matches[@]}" -eq 1 ]] || {
 echo 'MO_REL04_STAGE_PG_BOOTSTRAP_DENY=unexpected_container';exit 4;
}
readonly cid="${matches[0]}"
[[ "$(docker inspect -f '{{.State.Running}}' "$cid")" == true ]] || exit 4
actual="$(docker exec "$cid" sha256sum \
 /docker-entrypoint-initdb.d/10-staging-databases.sh | awk '{print $1}')" || exit 4
[[ "$actual" == "$SYNDES_STAGE_INIT_SHA256" ]] || {
 echo 'MO_REL04_STAGE_PG_BOOTSTRAP_DENY=script_drift';exit 4;
}
catalog() {
 docker exec "$cid" psql --no-psqlrc -X -At -v ON_ERROR_STOP=1 \
  --username postgres --dbname postgres --command \
 "SELECT
 (SELECT count(*)::int FROM pg_database WHERE datname='syndes_staging_keycloak')::text||':'||
 (SELECT count(*)::int FROM pg_database WHERE datname='syndes_staging_control')::text||':'||
 (SELECT count(*)::int FROM pg_roles WHERE rolname='syndes_staging_keycloak')::text||':'||
 (SELECT count(*)::int FROM pg_database WHERE datname NOT IN ('postgres','template0','template1'))::text"
}
state="$(catalog)" || exit 4
case "$state" in
 '1:1:1:2')
  echo 'MO_REL04_STAGE_PG_BOOTSTRAP_ALREADY_COMPLETE'
  ;;
 '0:0:0:0')
  # Docker Exec runs as the image's root bootstrap identity (unlike postgres
  # initdb scripts that can run as the unprivileged postgres user). The
  # reviewed script reads only the staging Docker secret inside the isolated
  # container. Neither stdin nor logs contain the password.
  docker exec "$cid" bash /docker-entrypoint-initdb.d/10-staging-databases.sh
  echo 'MO_REL04_STAGE_PG_BOOTSTRAP_RECOVERED_EMPTY_STAGE'
  ;;
 *)
  echo "MO_REL04_STAGE_PG_BOOTSTRAP_DENY=catalog_$state"
  exit 4
  ;;
esac
[[ "$(catalog)" == '1:1:1:2' ]] || {
 echo 'MO_REL04_STAGE_PG_BOOTSTRAP_DENY=postcondition';exit 4;
}
echo 'MO_REL04_STAGE_PG_BOOTSTRAP_CATALOG_VERIFIED'
