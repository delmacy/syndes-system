#!/usr/bin/env bash
# Keycloak26 official offline admin service recovery; isolated staging ONLY.
set -Eeuo pipefail
umask 077
[[ "$#" == 1 && "$1" == recover ]] || exit 2
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || exit 2
[[ "$SYNDES_STAGE_KC_ADMIN_RECOVERY" == CI_APPROVED_STAGE_PILOT_ADMIN ]] || exit 2
[[ "$SYNDES_STAGE_REAL_IDENTITY_SHA" =~ ^[0-9a-f]{40}$ ]] || exit 2
for exe in docker openssl stat; do command -v "$exe" >/dev/null || exit 3; done
root=/home/delmacy/.local/share/syndes-multiorg-staging
[[ -d "$root/secrets" && ! -L "$root" && ! -L "$root/secrets"
 && "$(stat -c %a "$root")" == 700
 && "$(stat -c %a "$root/secrets")" == 700 ]] || exit 3
secret="$root/secrets/pilot-admin-service-secret"
if [[ ! -e "$secret" && ! -L "$secret" ]];then
 tmp="$(mktemp "$root/secrets/.stage-admin.XXXXXXXX")"
 openssl rand -hex 32 > "$tmp"
 chmod 0600 "$tmp"
 mv -n "$tmp" "$secret"
 [[ ! -e "$tmp" ]] || { rm -f "$tmp";exit 3; }
fi
for file in "$secret" "$root/secrets/keycloak-db";do
 [[ -f "$file" && ! -L "$file" && "$(stat -c %a "$file")" == 600
   && "$(wc -c < "$file")" == 65 ]] || exit 3
done
one(){
 local component="$1" cid
 cid="$(docker ps --no-trunc -q \
 --filter label=com.docker.compose.project=syndes-multiorg-staging \
 --filter label=syndes.environment=multi-org-staging \
 --filter "label=syndes.component=$component")"
 [[ "$cid" =~ ^[a-f0-9]{64}$ ]] || return 4
 [[ "$(docker inspect -f '{{.State.Running}}' "$cid")" == true ]] || return 4
 printf '%s\n' "$cid"
}
pg="$(one control-postgres)" || exit 4
kc="$(one keycloak)" || exit 4
[[ "$(docker inspect -f '{{.Config.Image}}' "$pg")" == postgres:17-alpine ]] || exit 4
[[ "$(docker inspect -f '{{.Config.Image}}' "$kc")" == quay.io/keycloak/keycloak:26.8.1 ]] || exit 4
stage_client=syndes-stage-pilot-recovery
probe_client(){
 docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres \
  -d syndes_staging_keycloak -c "SELECT count(*) FROM public.client
  WHERE client_id='$stage_client'
   AND realm_id=(SELECT id FROM public.realm WHERE name='master')"
}
state="$(probe_client)" || exit 4
if [[ "$state" == 1 ]];then
 echo 'MO_REL04_STAGE_KC_ADMIN_SERVICE_ALREADY_INSTALLED'
 exit 0
fi
[[ "$state" == 0 ]] || { echo 'MO_REL04_STAGE_KC_BLOCKED=duplicate_service';exit 4; }
# Official recovery requires all Keycloak nodes stopped. Only stage is touched.
restart=0
restore(){
 if [[ "$restart" == 1 ]];then docker start "$kc" >/dev/null 2>&1 || true;fi
}
trap restore EXIT
docker stop "$kc" >/dev/null
restart=1
# Two one-line host-only secrets via STDIN, never in argv, Docker inspect or logs.
if ! { cat "$root/secrets/keycloak-db"; cat "$secret"; } |
 docker run --rm -i --network syndes-multiorg-staging_staging_internal \
 --cap-drop ALL --security-opt no-new-privileges \
 -e KC_DB=postgres \
 -e KC_DB_URL=jdbc:postgresql://control-postgres:5432/syndes_staging_keycloak \
 -e KC_DB_USERNAME=syndes_staging_keycloak \
 --entrypoint /bin/sh quay.io/keycloak/keycloak:26.8.1 -ec \
 'IFS= read -r KC_DB_PASSWORD
  IFS= read -r PILOT_BOOTSTRAP_SERVICE_SECRET
  export KC_DB_PASSWORD PILOT_BOOTSTRAP_SERVICE_SECRET
  exec /opt/keycloak/bin/kc.sh bootstrap-admin service --client-id syndes-stage-pilot-recovery --client-secret:env=PILOT_BOOTSTRAP_SERVICE_SECRET --no-prompt' \
 >/dev/null;then
 echo 'MO_REL04_STAGE_KC_BLOCKED=offline_admin_bootstrap'
 exit 5
fi
[[ "$(probe_client)" == 1 ]] || {
 echo 'MO_REL04_STAGE_KC_BLOCKED=bootstrap_client_missing';exit 5;
}
docker start "$kc" >/dev/null
restart=0
oidc_ready=0
for attempt in $(seq 1 24);do
 if docker exec "$pg" sh -ec \
  'wget -q -T 6 -O - http://keycloak:8080/realms/master/.well-known/openid-configuration | grep -q "\"issuer\""' \
 >/dev/null 2>&1;then
  oidc_ready=1;break
 fi
 sleep 5
done
[[ "$oidc_ready" == 1 ]] || {
 echo 'MO_REL04_STAGE_KC_BLOCKED=post_bootstrap_oidc';exit 5;
}
echo 'MO_REL04_STAGE_KEYCLOAK26_OFFLINE_ADMIN_SERVICE_RECOVERED'
