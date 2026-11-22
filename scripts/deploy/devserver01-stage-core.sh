#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
[[ "$#" == 3 && "$1" == apply ]] || exit 2
[[ "${SYNDES_STAGE_CORE_APPROVAL:-}" == ACTIONS_APPROVED_STAGE_CORE ]] || exit 2
[[ "${SOURCE_SHA:-}" =~ ^[a-f0-9]{40}$ ]] || exit 2
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || exit 2
bundle="$2";image="$3"
[[ "$image" == "syndes/core-host:stage-$SOURCE_SHA" ]] || exit 2
[[ -d "$bundle" && ! -L "$bundle" && "$(stat -c %a "$bundle")" == 700 ]] || exit 3
cd "$bundle";sha256sum -c MANIFEST.sha256 --status || exit 3
root=/home/delmacy/.local/share/syndes-multiorg-staging
[[ -d "$root/runtime" && "$(stat -c %a "$root")" == 700 ]] || exit 3
pg="$(docker ps --no-trunc -q --filter label=com.docker.compose.project=syndes-multiorg-staging --filter label=syndes.environment=multi-org-staging --filter label=syndes.component=control-postgres)"
[[ "$pg" =~ ^[a-f0-9]{64}$ && "$(docker inspect -f '{{.Config.Image}}' "$pg")" == postgres:17-alpine ]] || exit 3
[[ "$(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image")" == "$SOURCE_SHA" ]] || exit 3
digest="$(docker image inspect -f '{{.Id}}' "$image")"
[[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]] || exit 3
# Checkpoint all stage databases again before application/schema preparation.
for db in syndes_staging_control syndes_staging_keycloak syndes_staging_openfga syndes_tenant_1f5a8ce93f0148cca0132198d99e7510;do
 backup="$root/backups/$SOURCE_SHA-$db.dump.enc"
 if [[ ! -e "$backup" ]];then
  tmp="$(mktemp "$root/backups/.core.XXXXXXXX")"
  docker exec "$pg" pg_dump -U postgres -d "$db" -Fc | openssl enc -aes-256-cbc -pbkdf2 -salt -pass "file:$root/secrets/backup-key" -out "$tmp"
  chmod 600 "$tmp";mv "$tmp" "$backup"
 fi
done
operator_bundle="$root/runtime/operator-$SOURCE_SHA"
mkdir -p -m 700 "$operator_bundle"
cp "$bundle"/* "$operator_bundle/"
(cd "$operator_bundle" && sha256sum -c MANIFEST.sha256 --status) || exit 4
operator(){
 docker run --rm --user "$(id -u):$(id -g)" --network syndes-multiorg-staging_staging_internal \
 --read-only --tmpfs /tmp:rw,noexec,nosuid,size=32m --cap-drop ALL --security-opt no-new-privileges \
 --mount "type=bind,src=$operator_bundle,dst=/run/bundle,readonly" \
 --mount "type=bind,src=$root/secrets,dst=/run/stage" \
 --mount "type=bind,src=$root/runtime,dst=/run/runtime" \
 -e NODE_EXTRA_CA_CERTS=/run/runtime/tls/server.crt \
 -e SYNDES_STAGE_CORE_PREPARE=ACTIONS_STAGE_ONLY \
 -e "STAGE_IMAGE_DIGEST=$digest" -e "STAGE_CORE_IMAGE=$image" \
 --entrypoint node "$image" "$1" </dev/null
}
result="$(operator /run/bundle/prepare-core.mjs)"
printf '%s\n' "$result"
printf '%s\n' "$result" | grep -qx STAGE_CORE_OWNER_SQL_LEDGER_MODULE_ENABLED_EXPLICIT_FINE_GRANTS_PASS
previous_compose="$operator_bundle/previous-core-compose.yaml"
if [[ -f "$root/runtime/core-compose.yaml" ]];then
 cp "$root/runtime/core-compose.yaml" "$previous_compose"
fi
cp "$bundle/core-compose.yaml" "$root/runtime/core-compose.yaml";chmod 644 "$root/runtime/core-compose.yaml"
compose=(docker compose --env-file "$root/runtime/core.env" --project-name syndes-multiorg-staging -f "$root/compose.yaml" -f "$root/runtime/runtime-compose.yaml" -f "$root/runtime/core-compose.yaml")
"${compose[@]}" config --quiet
previous="$(docker ps -q --filter label=com.docker.compose.project=syndes-multiorg-staging --filter label=syndes.environment=multi-org-staging --filter label=syndes.component=core-host)"
previous_image=''
if [[ -n "$previous" ]];then previous_image="$(docker inspect -f '{{.Image}}' "$previous")";fi
vault="$(docker ps --no-trunc -q --filter label=com.docker.compose.project=syndes-multiorg-staging --filter label=syndes.environment=multi-org-staging --filter label=syndes.component=openbao-stage)"
[[ -z "$vault" || "$vault" =~ ^[a-f0-9]{64}$ ]] || exit 4
vault_paused=false
rollback(){
 status=$?
 if [[ "$vault_paused" == true ]];then docker unpause "$vault" >/dev/null || true;fi
 if [[ $status != 0 && -n "$previous_image" && -f "$previous_compose" ]];then
  cp "$previous_compose" "$root/runtime/core-compose.yaml"
  sed -i "s/^STAGE_CORE_IMAGE=.*/STAGE_CORE_IMAGE=$previous_image/" "$root/runtime/core.env"
  "${compose[@]}" up -d --no-deps --wait --wait-timeout 90 core-host </dev/null >/dev/null || true
 fi
}
trap rollback EXIT
if [[ -n "$vault" ]];then docker pause "$vault" >/dev/null;vault_paused=true;fi
# Core must start with its old credential provider unavailable.
if ! "${compose[@]}" up -d --no-deps --force-recreate --wait --wait-timeout 150 core-host </dev/null >/dev/null;then
 echo STAGE_CORE_DEPLOY_BLOCKED_READINESS;exit 5
fi
cid="$(docker ps --no-trunc -q --filter label=com.docker.compose.project=syndes-multiorg-staging --filter label=syndes.environment=multi-org-staging --filter label=syndes.component=core-host)"
[[ "$cid" =~ ^[a-f0-9]{64}$ && "$(docker inspect -f '{{.Image}}' "$cid")" == "$digest" ]] || exit 5
[[ "$(docker inspect -f '{{.Config.User}}' "$cid")" == 10001:10001 ]] || exit 5
docker exec "$cid" node -e "fetch('http://127.0.0.1:8082/readyz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" </dev/null
# Advisory singleton: a second real Core process in the same runtime namespace
# must fail to boot. Its sanitized output stays on the host and is not logged.
if timeout 20s docker exec "$cid" node dist/main.js </dev/null > "$root/runtime/second-core.log" 2>&1;then
 echo STAGE_CORE_DEPLOY_BLOCKED_SINGLETON;exit 5
else
 code=$?;[[ "$code" == 1 ]] || { echo STAGE_CORE_DEPLOY_BLOCKED_SINGLETON_TIMEOUT;exit 5; }
fi
# The first instance must still be ready after denying the second.
docker exec "$cid" node -e "fetch('http://127.0.0.1:8082/readyz').then(r=>{if(!r.ok)process.exit(1)})" </dev/null
if [[ "$vault_paused" == true ]];then
 docker unpause "$vault" >/dev/null;vault_paused=false
 docker stop --time 20 "$vault" >/dev/null
fi
trap - EXIT
echo STAGE_CORE_FILE_CREDENTIALS_START_WITHOUT_OPENBAO_PASS
echo STAGE_CORE_MAIN_NEST_IMAGE_READY_NONROOT_SINGLETON_PASS
