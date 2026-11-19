#!/usr/bin/env bash
# MO-REL-04: read-only REAL PostgreSQL/Keycloak/OpenFGA service smoke.
# Runs on DevServer01 only through GitHub Actions Tailscale SSH after CI gate.
# Never uses or prints operator credentials, JWTs, PII, DB contents or FGA tuples.
set -Eeuo pipefail
[[ "${1:-}" == verify && "$#" -eq 1 ]] || exit 2
[[ "${SYNDES_STAGING_REMOTE_MODE:-}" == "read-only-v1" ]] || exit 2
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || exit 2
command -v docker >/dev/null || exit 3
readonly project="syndes-multiorg-staging"
one() {
 local component="$1" cid count
 mapfile -t matches < <(docker ps -q --filter "label=com.docker.compose.project=$project" \
   --filter "label=syndes.environment=multi-org-staging" \
   --filter "label=syndes.component=$component")
 count="${#matches[@]}"
 [[ "$count" -eq 1 ]] || { echo "MO_REL04_SMOKE_BLOCKED=stage_$component"_count_"$count";return 4; }
 cid="${matches[0]}"
 [[ "$(docker inspect -f '{{.State.Running}}' "$cid")" == true ]] || return 4
 printf '%s\n' "$cid"
}
pg="$(one control-postgres)" || exit 4
kc="$(one keycloak)" || exit 4
fga="$(one openfga)" || exit 4
# The staging PG container has wget (BusyBox) on the isolated internal network.
# Never discover or route via the operational Syndes Docker networks.
dbok="$(docker exec "$pg" psql --no-psqlrc -X -At -v ON_ERROR_STOP=1 \
 --username postgres --dbname postgres \
 --command "SELECT CASE WHEN
  (SELECT count(*) FROM pg_database WHERE datname IN
   ('syndes_staging_keycloak','syndes_staging_control'))=2
  AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname='syndes_staging_keycloak')
  THEN 'STAGE_OK' ELSE 'BLOCKED' END")" || exit 4
[[ "$dbok" == STAGE_OK ]] || { echo 'MO_REL04_SMOKE_BLOCKED=staging_databases';exit 4; }
echo 'MO_REL04_STAGING_SQL_CONTROL_AND_KEYCLOAK_ROLE_PASS'
# Use the isolated PG container as HTTP client to prove actual Keycloak and
# OpenFGA responses. Do not print any response body, token or realm list.
docker exec "$pg" sh -ec \
 'wget -q -T 10 -O - http://keycloak:8080/realms/master/.well-known/openid-configuration | grep -q "\"issuer\""' \
 >/dev/null || { echo 'MO_REL04_SMOKE_BLOCKED=keycloak_http';exit 4; }
echo 'MO_REL04_STAGING_KEYCLOAK_REAL_HTTP_PASS'
docker exec "$pg" sh -ec \
 'wget -q -T 10 -O - http://openfga:8080/healthz >/dev/null' \
 >/dev/null || { echo 'MO_REL04_SMOKE_BLOCKED=openfga_http';exit 4; }
echo 'MO_REL04_STAGING_OPENFGA_REAL_HTTP_PASS'
echo 'MO_REL04_STAGING_REAL_SERVICE_SMOKE_PASS_NOT_MULTIORG_E2E'
