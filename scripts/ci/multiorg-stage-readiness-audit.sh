#!/usr/bin/env bash
# MO-REL-04 stage-only READ-ONLY readiness audit. No credentials or data output.
# Intended for the existing GitHub Actions -> Tailscale -> DevServer01 path.
set -Eeuo pipefail
[[ "${1:-}" == audit && "$#" -eq 1 ]] || exit 2
[[ "${SYNDES_STAGING_REMOTE_MODE:-}" == read-only-v1 ]] || exit 2
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || exit 2
command -v docker >/dev/null || exit 3
readonly project=syndes-multiorg-staging
one() {
  local component="$1" count cid
  local -a matches
  mapfile -t matches < <(docker ps -q \
    --filter "label=com.docker.compose.project=$project" \
    --filter 'label=syndes.environment=multi-org-staging' \
    --filter "label=syndes.component=$component")
  count="${#matches[@]}"
  [[ "$count" -eq 1 ]] || {
    echo "MO_REL04_READINESS_BLOCKED=stage_${component}_count_${count}"
    return 4
  }
  cid="${matches[0]}"
  [[ "$(docker inspect -f '{{.State.Running}}' "$cid")" == true ]] || {
    echo "MO_REL04_READINESS_BLOCKED=stage_${component}_not_running"
    return 4
  }
  printf '%s\n' "$cid"
}
pg="$(one control-postgres)" || exit 4
fga="$(one openfga)" || exit 4
kc="$(one keycloak)" || exit 4
# This checks configuration without ever printing the URI/secret-bearing env.
# A memory store must NEVER be interpreted as durable authorization.
# A secret-derived OpenFGA config is mounted read-only at the canonical
# v1.22 configuration path. The PostgreSQL schema must also exist.
mounted="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/openfga/config.yaml"}}postgres_config{{end}}{{end}}' "$fga")" || exit 4
[[ "$mounted" == postgres_config ]] || {
  echo 'MO_REL04_READINESS_BLOCKED=fga_not_persistent'
  exit 4
}
durable="$(docker exec "$pg" psql --no-psqlrc -X -At -v ON_ERROR_STOP=1 \
  --username postgres --dbname postgres \
  --command "SELECT CASE WHEN EXISTS(SELECT 1 FROM pg_database WHERE datname='syndes_staging_openfga') AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname='syndes_staging_openfga') THEN 'PRESENT' ELSE 'MISSING' END")" || exit 4
[[ "$durable" == PRESENT ]] || {
  echo 'MO_REL04_READINESS_BLOCKED=fga_pg_missing'
  exit 4
}
echo 'MO_REL04_READINESS_FGA_CONFIG_POSTGRES_PASS'
# Sanity check only, not evidence of FGA tuple durability or restored grants.
control="$(docker exec "$pg" psql --no-psqlrc -X -At -v ON_ERROR_STOP=1 \
  --username postgres --dbname syndes_staging_control \
  --command "SELECT CASE WHEN to_regnamespace('syndes_control') IS NOT NULL THEN 'PRESENT' ELSE 'MISSING' END")" || {
  echo 'MO_REL04_READINESS_BLOCKED=control_query'
  exit 4
}
[[ "$control" == PRESENT ]] || {
  echo 'MO_REL04_READINESS_BLOCKED=control_schema_missing'
  exit 4
}
echo 'MO_REL04_READINESS_CONTROL_SCHEMA_PRESENT'
core="$(one core-host)" || exit 4
echo 'MO_REL04_READINESS_CORE_CONTAINER_PRESENT'
# There is deliberately NO READY result here: this is not a substitute for
# signed Keycloak identity, FGA fine grants, revocation, restore or A/B E2E.
echo 'MO_REL04_READINESS_STATIC_TOPOLOGY_PASS_NOT_PRODUCT_GATE'
