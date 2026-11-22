#!/usr/bin/env bash
# Transactional historical fixture only: the postgres maintenance DB is never
# used for customer records and the fixture schema is rolled back in all paths.
set -Eeuo pipefail
umask 077
[[ "$#" == 2 && "$1" == verify ]] || exit 2
[[ "${SYNDES_STAGE_HISTORICAL_APPROVAL:-}" == ACTIONS_APPROVED_STAGE_HISTORICAL ]] || exit 2
[[ "${SOURCE_SHA:-}" =~ ^[a-f0-9]{40}$ && "${EXPECTED_CORE_SHA:-}" =~ ^[a-f0-9]{40}$ ]] || exit 2
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || exit 2
bundle="$2"
[[ -d "$bundle" && ! -L "$bundle" && "$(stat -c %a "$bundle")" == 700 ]] || exit 3
cd "$bundle"
sha256sum -c MANIFEST.sha256 --status || exit 3
root=/home/delmacy/.local/share/syndes-multiorg-staging
[[ -d "$root/secrets" && -f "$root/secrets/pg-admin" ]] || exit 3
one(){
 local cid
 cid="$(docker ps --no-trunc -q --filter label=com.docker.compose.project=syndes-multiorg-staging --filter label=syndes.environment=multi-org-staging --filter "label=syndes.component=$1")"
 [[ "$cid" =~ ^[a-f0-9]{64}$ ]] || return 3
 printf '%s\n' "$cid"
}
pg="$(one control-postgres)"
core="$(one core-host)"
[[ "$(docker inspect -f '{{.Config.Image}}' "$pg")" == postgres:17-alpine ]] || exit 3
[[ "$(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$core")" == "$EXPECTED_CORE_SHA" ]] || exit 3
image="$(docker inspect -f '{{.Image}}' "$core")"
[[ "$image" =~ ^sha256:[a-f0-9]{64}$ ]] || exit 3
# The script binds no runtime directory and cannot create a database.
result="$(docker run --rm --user "$(id -u):$(id -g)" --network syndes-multiorg-staging_staging_internal \
 --read-only --tmpfs /tmp:rw,noexec,nosuid,size=32m --cap-drop ALL --security-opt no-new-privileges \
 --mount "type=bind,src=$bundle,dst=/run/bundle,readonly" \
 --mount "type=bind,src=$root/secrets,dst=/run/stage,readonly" \
 -e SYNDES_STAGE_HISTORICAL=ACTIONS_STAGE_ONLY --entrypoint node "$image" \
 /run/bundle/historical-cutover.mjs </dev/null)"
printf '%s\n' "$result"
printf '%s\n' "$result" | grep -qx STAGE_HISTORICAL_LEGACY_ROWS_BACKFILL_PARTIAL_DENY_SQL002_IAM008_009_010_CUTOVER_ROLLBACK_PASS
printf 'STAGE_HISTORICAL_CORE_IMAGE=%s\n' "$image"
echo STAGE_HISTORICAL_STAGING_TRANSACTIONAL_FIXTURE_PASS
