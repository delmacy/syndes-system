#!/usr/bin/env bash
# MO-REL-04 stage-only Keycloak restart AFTER the empty PG bootstrap has been
# successfully repaired. Never touches operational Core/Keycloak or tenants.
set -Eeuo pipefail
[[ "${1:-}" == recover && "$#" -eq 1 ]] || exit 2
[[ "${SYNDES_STAGE_KC_RECOVERY:-}" == CI_APPROVED_MO_REL04 ]] || exit 2
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || exit 2
command -v docker >/dev/null || exit 3
project='syndes-multiorg-staging'
stage_container() {
 local component="$1" cid
 local -a matches
 mapfile -t matches < <(docker ps -aq \
  --filter "label=com.docker.compose.project=$project" \
  --filter "label=syndes.environment=multi-org-staging" \
  --filter "label=syndes.component=$component")
 [[ "${#matches[@]}" -eq 1 ]] || {
   echo "MO_REL04_STAGE_KC_RECOVERY_DENY=unexpected_$component"; return 4;
 }
 cid="${matches[0]}"
 [[ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.service"}}' "$cid")" == "$component" ]] || {
   echo "MO_REL04_STAGE_KC_RECOVERY_DENY=service_label_$component"; return 4;
 }
 printf '%s\n' "$cid"
}
pg="$(stage_container control-postgres)" || exit 4
kc="$(stage_container keycloak)" || exit 4
[[ "$(docker inspect -f '{{.State.Running}}' "$pg")" == true ]] || exit 4
db_state="$(docker exec "$pg" psql --no-psqlrc -X -At -v ON_ERROR_STOP=1 \
 --username postgres --dbname postgres --command \
 "SELECT (SELECT count(*) FROM pg_database WHERE datname='syndes_staging_control')::text||':'||
         (SELECT count(*) FROM pg_database WHERE datname='syndes_staging_keycloak')::text||':'||
         (SELECT count(*) FROM pg_roles WHERE rolname='syndes_staging_keycloak')::text")" || exit 4
[[ "$db_state" == '1:1:1' ]] || {
 echo 'MO_REL04_STAGE_KC_RECOVERY_DENY=incomplete_staging_catalog';exit 4;
}
oidc() {
 # Fetch public metadata ONLY from the already checked isolated stage network.
 docker exec "$pg" sh -ec \
 'wget -q -T 7 -O - http://keycloak:8080/realms/master/.well-known/openid-configuration | grep -q "\"issuer\""' \
 >/dev/null 2>&1
}
if oidc; then
 echo 'MO_REL04_STAGE_KC_ALREADY_HTTP_READY'
 exit 0
fi
# Keycloak first boot may have failed before its DB/role existed. Restart only
# this isolated stage Keycloak container, not any PG/operational process.
docker restart "$kc" >/dev/null
echo 'MO_REL04_STAGE_KC_RESTARTED_STAGE_ONLY'
for attempt in $(seq 1 18); do
 if oidc; then
  echo 'MO_REL04_STAGE_KC_POST_BOOTSTRAP_OIDC_PASS'
  exit 0
 fi
 sleep 8
done
echo 'MO_REL04_STAGE_KC_RECOVERY_BLOCKED=oidc_unavailable'
exit 4
