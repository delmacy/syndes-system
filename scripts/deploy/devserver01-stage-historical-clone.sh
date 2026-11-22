#!/usr/bin/env bash
# Staging only. Creates, restores and removes two exact synthetic scratch DBs.
set -Eeuo pipefail
umask 077
[[ "$#" == 2 && "$1" == verify ]] || exit 2
[[ "${SYNDES_STAGE_HISTORICAL_CLONE_APPROVAL:-}" == ACTIONS_APPROVED_HISTORICAL_CLONE ]] || exit 2
[[ "${SOURCE_SHA:-}" =~ ^[a-f0-9]{40}$ && "${EXPECTED_CORE_SHA:-}" =~ ^[a-f0-9]{40}$ ]] || exit 2
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || exit 2
bundle="$2"
[[ -d "$bundle" && ! -L "$bundle" && "$(stat -c %a "$bundle")" == 700 ]] || exit 3
cd "$bundle";sha256sum -c MANIFEST.sha256 --status || exit 3
root=/home/delmacy/.local/share/syndes-multiorg-staging
[[ -f "$root/secrets/pg-admin" && -f "$root/secrets/backup-key" && -d "$root/backups" ]] || exit 3
one(){
 local cid
 cid="$(docker ps --no-trunc -q --filter label=com.docker.compose.project=syndes-multiorg-staging --filter label=syndes.environment=multi-org-staging --filter "label=syndes.component=$1")"
 [[ "$cid" =~ ^[a-f0-9]{64}$ ]] || return 3
 printf '%s\n' "$cid"
}
pg="$(one control-postgres)";core="$(one core-host)"
[[ "$(docker inspect -f '{{.Config.Image}}' "$pg")" == postgres:17-alpine ]] || exit 3
[[ "$(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$core")" == "$EXPECTED_CORE_SHA" ]] || exit 3
image="$(docker inspect -f '{{.Image}}' "$core")"
[[ "$image" =~ ^sha256:[a-f0-9]{64}$ ]] || exit 3
nonce="$(openssl rand -hex 6)"
source="syndes_hist_${nonce}_s";target="syndes_hist_${nonce}_t"
[[ "$source" =~ ^syndes_hist_[a-f0-9]{12}_s$ && "$target" == "${source%?}t" ]] || exit 3
created=()
cleanup(){
 local db active owner rc=$?
 for db in "${created[@]}";do
  [[ "$db" == "$source" || "$db" == "$target" ]] || continue
  owner="$(docker exec "$pg" psql -X -At -U postgres -d postgres -c "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname='$db'" 2>/dev/null || true)"
  active="$(docker exec "$pg" psql -X -At -U postgres -d postgres -c "SELECT count(*) FROM pg_stat_activity WHERE datname='$db'" 2>/dev/null || true)"
  if [[ "$owner" == postgres && "$active" == 0 ]];then
   if ! docker exec "$pg" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "DROP DATABASE $db" >/dev/null;then rc=5;fi
  else
   printf 'STAGE_HISTORICAL_SCRATCH_CLEANUP_BLOCKED=%s\n' "$db" >&2
   rc=5
  fi
 done
 exit "$rc"
}
trap cleanup EXIT
for db in "$source" "$target";do
 [[ "$(docker exec "$pg" psql -X -At -U postgres -d postgres -c "SELECT count(*) FROM pg_database WHERE datname='$db'")" == 0 ]] || exit 5
 docker exec "$pg" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "CREATE DATABASE $db OWNER postgres" >/dev/null
 created+=("$db")
 docker exec "$pg" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "REVOKE CONNECT ON DATABASE $db FROM PUBLIC" >/dev/null
done
operator(){
 docker run --rm --user "$(id -u):$(id -g)" --network syndes-multiorg-staging_staging_internal \
 --read-only --tmpfs /tmp:rw,noexec,nosuid,size=32m --cap-drop ALL --security-opt no-new-privileges \
 --mount "type=bind,src=$bundle,dst=/run/bundle,readonly" \
 --mount "type=bind,src=$root/secrets,dst=/run/stage,readonly" \
 -e SYNDES_HISTORICAL_CLONE=ACTIONS_STAGE_ONLY -e "STAGE_HISTORICAL_SOURCE=$source" \
 -e "STAGE_HISTORICAL_TARGET=$target" --entrypoint node "$image" \
 /run/bundle/historical-clone.mjs "$1" </dev/null
}
operator seed
backup="$root/backups/historical-$SOURCE_SHA-$nonce.dump.enc"
started="$(date +%s)"
temp="$(mktemp "$root/backups/.historical.XXXXXXXX")"
docker exec "$pg" pg_dump -U postgres -d "$source" -n historical -Fc | openssl enc -aes-256-cbc -pbkdf2 -salt -pass "file:$root/secrets/backup-key" -out "$temp"
chmod 600 "$temp";mv "$temp" "$backup"
printf 'STAGE_HISTORICAL_ENCRYPTED_BACKUP_SHA256=%s\n' "$(sha256sum "$backup" | cut -d' ' -f1)"
openssl enc -d -aes-256-cbc -pbkdf2 -pass "file:$root/secrets/backup-key" -in "$backup" | docker exec -i "$pg" pg_restore --exit-on-error -U postgres -d "$target" >/dev/null
operator compare
# The only committed cutover runs in a restored synthetic target, with all
# attestations scoped to this psql session and a single atomic transaction.
{
 printf 'SET search_path TO historical;\n'
 printf "SELECT set_config('syndes.multi_context_gate','approved',true),set_config('syndes.restorable_backup','verified',true),set_config('syndes.scoped_host','verified',true);\n"
 cat "$bundle/sql/organizations/manual/activate_multiple_organizations.sql"
} | docker exec -i "$pg" psql -X --single-transaction -v ON_ERROR_STOP=1 -U postgres -d "$target" >/dev/null
operator cutover-check
printf 'STAGE_HISTORICAL_RESTORE_RTO_SECONDS=%s\n' "$(( $(date +%s)-started ))"
echo STAGE_HISTORICAL_ENCRYPTED_RESTORE_PSQL_SINGLE_TRANSACTION_CUTOVER_PASS
