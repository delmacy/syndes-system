#!/usr/bin/env bash
# Real acceptance and recovery of stage only. Never modifies a source DB on restore.
set -Eeuo pipefail
umask 077
[[ "$#" == 2 && "$1" == verify ]] || exit 2
[[ "${SYNDES_STAGE_ACCEPTANCE_APPROVAL:-}" == ACTIONS_APPROVED_STAGE_ACCEPTANCE ]] || exit 2
[[ "${SOURCE_SHA:-}" =~ ^[a-f0-9]{40}$ && "${EXPECTED_CORE_SHA:-}" =~ ^[a-f0-9]{40}$ ]] || exit 2
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || exit 2
bundle="$2";[[ -d "$bundle" && ! -L "$bundle" && "$(stat -c %a "$bundle")" == 700 ]] || exit 3
cd "$bundle";sha256sum -c MANIFEST.sha256 --status || exit 3
root=/home/delmacy/.local/share/syndes-multiorg-staging
[[ -d "$root/runtime" && "$(stat -c %a "$root")" == 700 ]] || exit 3
one(){
 local cid
 cid="$(docker ps --no-trunc -q --filter label=com.docker.compose.project=syndes-multiorg-staging --filter label=syndes.environment=multi-org-staging --filter "label=syndes.component=$1")"
 [[ "$cid" =~ ^[a-f0-9]{64}$ ]] || return 3
 printf '%s\n' "$cid"
}
pg="$(one control-postgres)";core="$(one core-host)";kc="$(one keycloak)";fga="$(one openfga)"
[[ "$(docker inspect -f '{{.Config.Image}}' "$pg")" == postgres:17-alpine ]] || exit 3
[[ "$(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$core")" == "$EXPECTED_CORE_SHA" ]] || exit 3
image="$(docker inspect -f '{{.Image}}' "$core")"
[[ "$image" =~ ^sha256:[a-f0-9]{64}$ ]] || exit 3
printf 'STAGE_VERIFIED_CORE_SOURCE=%s\nSTAGE_VERIFIED_CORE_IMAGE=%s\n' "$EXPECTED_CORE_SHA" "$image"
operator_bundle="$root/runtime/acceptance-$SOURCE_SHA"
mkdir -p -m 700 "$operator_bundle";cp "$bundle"/* "$operator_bundle/"
operator(){
 docker run --rm --user "$(id -u):$(id -g)" --network syndes-multiorg-staging_staging_internal \
 --read-only --tmpfs /tmp:rw,noexec,nosuid,size=32m --cap-drop ALL --security-opt no-new-privileges \
 --mount "type=bind,src=$operator_bundle,dst=/run/bundle,readonly" \
 --mount "type=bind,src=$root/secrets,dst=/run/stage,readonly" \
 --mount "type=bind,src=$root/runtime,dst=/run/runtime" \
 -e NODE_EXTRA_CA_CERTS=/run/runtime/tls/server.crt \
 -e SYNDES_STAGE_ACCEPTANCE=ACTIONS_STAGE_ONLY -e SYNDES_STAGE_RESTORE=ACTIONS_STAGE_ONLY \
 -e SYNDES_STAGE_OUTAGE=ACTIONS_STAGE_ONLY -e "OUTAGE_MODE=${OUTAGE_MODE:-cleanup}" \
 -e "VAULT_SNAPSHOT_MODE=${VAULT_SNAPSHOT_MODE:-backup}" \
 -e SYNDES_DEPLOYMENT_ENV=staging -e CORE_OPENBAO_URL=https://openbao-stage:8200 \
 -e CORE_TENANT_ROLE_ID_FILE=/run/stage/bao-tenant-role-id \
 -e CORE_TENANT_SECRET_ID_FILE=/run/stage/bao-tenant-secret-id \
 -e "SOURCE_SHA=$SOURCE_SHA" --entrypoint node "$image" "$1" </dev/null
}
# Use a DIFFERENT port: denial cannot be explained by address-in-use.
if timeout 20s docker exec -e CORE_PORT=8083 "$core" node dist/main.js </dev/null > "$root/runtime/acceptance-second-core.log" 2>&1;then
 echo STAGE_ACCEPTANCE_BLOCKED_SECOND_CORE_ADMITTED;exit 5
else
 code=$?;[[ "$code" == 1 ]] || exit 5
fi
result="$(operator /run/bundle/validate-core.mjs)";printf '%s\n' "$result"
printf '%s\n' "$result" | grep -qx STAGE_CORE_REAL_HTTP_IDP_FGA_SQL_WORKER_SSE_ACCEPTANCE_PASS
# Real network outage: a valid JWT cannot write while KC or FGA is unavailable.
OUTAGE_MODE=prepare operator /run/bundle/outage.mjs
paused=''
resume_provider(){ if [[ -n "$paused" ]];then docker unpause "$paused" >/dev/null 2>&1 || true;fi; }
trap resume_provider EXIT
for component in openfga identity-stage;do
 paused="$(one "$component")"
 docker pause "$paused" >/dev/null
 result="$(OUTAGE_MODE=check operator /run/bundle/outage.mjs)";printf '%s\n' "$result"
 printf '%s\n' "$result" | grep -qx STAGE_REAL_PROVIDER_OUTAGE_HTTP_DENY_ZERO_AUDIT_WRITE_PASS
 docker unpause "$paused" >/dev/null;paused=''
done
OUTAGE_MODE=cleanup operator /run/bundle/outage.mjs
trap - EXIT
# Pause only isolated stage writers for a coordinated four-service checkpoint.
# On all error paths resume providers and Core. No production resources selected.
core_stopped=0;kc_paused=0;fga_paused=0;kc_stopped=0;fga_stopped=0
swapped=();targets=();sources=();archives=();recovery_complete=0
recover(){
 if [[ "$recovery_complete" != 1 && "${#swapped[@]}" -gt 0 ]];then
  docker stop "$core" "$kc" "$fga" >/dev/null 2>&1 || true
  core_stopped=1;kc_stopped=1;fga_stopped=1
  for ((i=${#swapped[@]}-1;i>=0;i--));do
   docker exec "$pg" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "ALTER DATABASE ${sources[$i]} RENAME TO ${targets[$i]}" >/dev/null 2>&1 || true
   docker exec "$pg" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "ALTER DATABASE ${archives[$i]} RENAME TO ${sources[$i]}" >/dev/null 2>&1 || true
  done
 fi
 if [[ "$kc_stopped" == 1 ]];then docker start "$kc" >/dev/null 2>&1 || true;fi
 if [[ "$fga_stopped" == 1 ]];then docker start "$fga" >/dev/null 2>&1 || true;fi
 if [[ "$kc_paused" == 1 ]];then docker unpause "$kc" >/dev/null 2>&1 || true;fi
 if [[ "$fga_paused" == 1 ]];then docker unpause "$fga" >/dev/null 2>&1 || true;fi
 docker restart "$(one identity-stage)" >/dev/null 2>&1 || true
 if [[ "$core_stopped" == 1 ]];then docker start "$core" >/dev/null 2>&1 || true;fi
}
trap recover EXIT
docker stop "$core" >/dev/null;core_stopped=1
VAULT_SNAPSHOT_MODE=backup operator /run/bundle/vault-snapshot.mjs
cp "$root/runtime/bao.snapshot.enc" "$root/backups/acceptance-$SOURCE_SHA-bao.snapshot.enc"
chmod 600 "$root/backups/acceptance-$SOURCE_SHA-bao.snapshot.enc"
printf 'STAGE_ENCRYPTED_OPENBAO_SHA256=%s\n' "$(cat "$root/runtime/bao.snapshot.sha256")"
docker pause "$kc" >/dev/null;kc_paused=1
docker pause "$fga" >/dev/null;fga_paused=1
started="$(date +%s)"
nonce="$(openssl rand -hex 6)"
map_file="$root/runtime/restore-map.json"
printf '[' > "$map_file";counter=0
for source in syndes_staging_control syndes_staging_keycloak syndes_staging_openfga syndes_tenant_1f5a8ce93f0148cca0132198d99e7510 syndes_tenant_22222222222242228222222222222222;do
 target="syndes_restore_${nonce}_$counter"
 [[ "$target" =~ ^syndes_restore_[a-f0-9]{12}_[0-4]$ ]] || exit 4
 backup="$root/backups/acceptance-$SOURCE_SHA-$source.dump.enc"
 temp="$(mktemp "$root/backups/.restore-checkpoint.XXXXXXXX")"
 docker exec "$pg" pg_dump -U postgres -d "$source" -Fc | openssl enc -aes-256-cbc -pbkdf2 -salt -pass "file:$root/secrets/backup-key" -out "$temp"
 chmod 600 "$temp";mv "$temp" "$backup"
 sha256sum "$backup" | cut -d' ' -f1 | sed "s/^/STAGE_ENCRYPTED_BACKUP_SHA256_${counter}=/"
 # New scratch destination ONLY; neither --clean nor source overwrite is used.
 docker exec "$pg" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "CREATE DATABASE $target OWNER postgres" >/dev/null
 docker exec "$pg" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "REVOKE CONNECT ON DATABASE $target FROM PUBLIC" >/dev/null
 openssl enc -d -aes-256-cbc -pbkdf2 -pass "file:$root/secrets/backup-key" -in "$backup" | docker exec -i "$pg" pg_restore --exit-on-error -U postgres -d "$target" >/dev/null
 # Preserve database ownership and explicit CONNECT ACL, including the
 # pg_database_owner semantics used by Keycloak and OpenFGA migrations.
 owner="$(docker exec "$pg" psql -X -At -U postgres -d postgres -c "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname='$source'")"
 [[ "$owner" =~ ^(postgres|syndes_staging_keycloak|syndes_staging_openfga)$ ]] || exit 4
 docker exec "$pg" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "ALTER DATABASE $target OWNER TO $owner" >/dev/null
 docker exec "$pg" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "SELECT format('GRANT %s ON DATABASE %I TO %I;',a.privilege_type,'$target',r.rolname) FROM pg_database d CROSS JOIN LATERAL aclexplode(COALESCE(d.datacl,acldefault('d',d.datdba))) a JOIN pg_roles r ON r.oid=a.grantee WHERE d.datname='$source'" -At | docker exec -i "$pg" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres >/dev/null
 sources+=("$source");targets+=("$target");archives+=("syndes_stage_archive_${nonce}_$counter")
 if ((counter>0));then printf ',' >> "$map_file";fi
 printf '{"source":"%s","target":"%s"}' "$source" "$target" >> "$map_file"
 counter=$((counter+1))
done
printf ']\n' >> "$map_file";chmod 644 "$map_file"
comparison="$(operator /run/bundle/compare-restore.mjs)";printf '%s\n' "$comparison"
printf '%s\n' "$comparison" | grep -qx STAGE_RESTORE_FIVE_REAL_DATABASES_ALL_TABLE_COUNTS_HASHES_MULTI_ORG_SQL002_STATE_PASS
elapsed=$(( $(date +%s)-started ))
printf 'STAGE_RESTORE_MEASURED_SECONDS=%s\n' "$elapsed"
docker unpause "$kc" >/dev/null;kc_paused=0
docker unpause "$fga" >/dev/null;fga_paused=0
docker stop "$kc" >/dev/null;kc_stopped=1
docker stop "$fga" >/dev/null;fga_stopped=1
# Archive each original, then give the verified restore its canonical name.
# No source is dropped. On failure, reverse the swaps and restart originals.
for ((i=0;i<${#sources[@]};i++));do
 connections="$(docker exec "$pg" psql -X -At -U postgres -d postgres -c "SELECT count(*) FROM pg_stat_activity WHERE datname='${sources[$i]}'")"
 [[ "$connections" == 0 ]] || exit 5
 docker exec "$pg" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "ALTER DATABASE ${sources[$i]} RENAME TO ${archives[$i]}" >/dev/null
 if ! docker exec "$pg" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "ALTER DATABASE ${targets[$i]} RENAME TO ${sources[$i]}" >/dev/null;then
  docker exec "$pg" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "ALTER DATABASE ${archives[$i]} RENAME TO ${sources[$i]}" >/dev/null || true
  exit 5
 fi
 swapped+=("$i")
done
VAULT_SNAPSHOT_MODE=restore operator /run/bundle/vault-snapshot.mjs
docker start "$kc" >/dev/null;kc_stopped=0
docker start "$fga" >/dev/null;fga_stopped=0
docker restart "$(one identity-stage)" >/dev/null
# Print the effective stage-only proxy route to diagnose the restored realm 404.
docker exec "$(one identity-stage)" nginx -T 2>&1 | sed -n '/^# configuration file \/etc\/nginx\/conf.d\/default.conf:/,/^}/p' >&2
printf 'STAGE_PROXY_EXPECTED_KEYCLOAK_IP=%s STAGE_PROXY_CONTAINER_IP=%s\n' "$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$kc")" "$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$(one identity-stage)")" >&2
sleep 5
docker start "$core" >/dev/null;core_stopped=0
for n in $(seq 1 45);do
 if docker exec "$core" node -e "fetch('http://127.0.0.1:8082/readyz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" </dev/null >/dev/null 2>&1;then break;fi
 [[ "$n" != 45 ]] || exit 5;sleep 2
done
[[ "$(docker inspect -f '{{.Image}}' "$core")" == "$image" ]] || exit 5
# Same identities and permissions remain valid after restart; acceptance also
# confirms revocation/cleanup/reconnection against the same real image.
result="$(operator /run/bundle/validate-core.mjs)";printf '%s\n' "$result"
printf '%s\n' "$result" | grep -qx STAGE_CORE_REAL_HTTP_IDP_FGA_SQL_WORKER_SSE_ACCEPTANCE_PASS
recovery_complete=1
printf 'STAGE_REAL_RESTORE_RTO_SECONDS=%s\n' "$(( $(date +%s)-started ))"
echo STAGE_ACCEPTANCE_AND_ENCRYPTED_FIVE_DB_RESTORE_SAME_CORE_IMAGE_RECOVERY_PASS
