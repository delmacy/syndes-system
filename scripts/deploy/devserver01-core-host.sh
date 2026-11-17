#!/usr/bin/env bash
# GitHub Actions only: update ONLY the approved Core Host Compose service.
# Input: immutable image, compose project, directory, file, service, manifest SHA256.
set -Eeuo pipefail
if [[ $# -ne 6 ]]; then echo "Invalid deployment contract" >&2; exit 2; fi
image="$1" project="$2" dir="$3" file="$4" service="$5" manifest_digest="$6"
[[ "$image" =~ ^syndes/core-host:git-[a-f0-9]{40}$ ]] || { echo "Image not pinned to Git SHA" >&2; exit 2; }
[[ "$project" =~ ^[a-z][a-z0-9_-]{1,63}$ ]] || exit 2
[[ "$service" =~ ^[a-z][a-z0-9_-]{1,63}$ ]] || exit 2
[[ "$dir" =~ ^/[a-zA-Z0-9_./-]+$ && "$dir" != *".."* ]] || exit 2
[[ "$file" =~ ^[a-zA-Z0-9_./-]+$ && "$file" != *".."* ]] || exit 2
[[ "$manifest_digest" =~ ^[a-f0-9]{64}$ ]] || exit 2
command -v docker >/dev/null
command -v sha256sum >/dev/null
cd "$dir"
[[ -f "$file" && -r "$file" ]] || { echo "Approved Compose manifest unavailable" >&2; exit 3; }
actual_digest="$(sha256sum "$file" | awk '{print $1}')"
[[ "$actual_digest" == "$manifest_digest" ]] || { echo "Compose manifest digest drift: refusing deployment" >&2; exit 3; }
compose(){ docker compose --project-name "$project" --file "$file" "$@"; }
compose config --services | grep -qx "$service" || { echo "Unknown Compose service" >&2; exit 3; }
compose version >/dev/null
old_cid="$(compose ps -q "$service")"
[[ -n "$old_cid" ]] || { echo "Existing Core Host service required" >&2; exit 3; }
previous="$(docker inspect --format '{{.Config.Image}}' "$old_cid")"
[[ "$previous" == syndes/core-host:* ]] || { echo "Unexpected previous image; refusing deployment" >&2; exit 3; }
docker image inspect "$image" >/dev/null || { echo "Approved image was not loaded" >&2; exit 3; }
# Never print secrets or full container environment.
env_value(){
 docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$1" |
  awk -v match="$2=" 'index($0,match)==1 {print substr($0,length(match)+1);exit}'
}
old_dispatch="$(env_value "$old_cid" "WHATSAPP_DISPATCH_ENABLED")"
old_multi="$(env_value "$old_cid" "SYNDES_MULTI_ORG_ENABLED")"
[[ "$old_multi" != "true" ]] || { echo "Multi-org rollout outside this release" >&2; exit 3; }
# Fail before changing anything if the full existing Compose configuration is not resolvable.
SYNDES_CORE_HOST_IMAGE="$image" compose config --quiet
switched=false
verified=false
rollback_on_failure(){
 result=$?
 trap - EXIT
 if [[ "$switched" == true && "$verified" != true ]]; then
  echo "Release smoke failed; attempting scoped Core Host rollback" >&2
  if ! SYNDES_CORE_HOST_IMAGE="$previous" compose up -d --no-deps "$service"; then
   echo "Rollback attempt failed: manual operator intervention required" >&2
  fi
 fi
 exit "$result"
}
trap rollback_on_failure EXIT
# Set rollback intent BEFORE the command: Docker may partially switch then fail.
switched=true
SYNDES_CORE_HOST_IMAGE="$image" compose up -d --no-deps "$service"
new_cid="$(compose ps -q "$service")"
[[ -n "$new_cid" ]] || { echo "No Core Host container after cutover" >&2; exit 4; }
actual_image="$(docker inspect --format '{{.Config.Image}}' "$new_cid")"
[[ "$actual_image" == "$image" ]] || { echo "Unexpected Core Host image after cutover" >&2; exit 4; }
[[ "$(env_value "$new_cid" "WHATSAPP_DISPATCH_ENABLED")" == "$old_dispatch" ]] ||
 { echo "WhatsApp dispatch toggle changed unexpectedly" >&2; exit 4; }
[[ "$(env_value "$new_cid" "SYNDES_MULTI_ORG_ENABLED")" == "$old_multi" ]] ||
 { echo "Multi-org toggle changed unexpectedly" >&2; exit 4; }
ready=false
for attempt in $(seq 1 20); do
 if docker exec "$new_cid" node -e 'fetch("http://127.0.0.1:8082/readyz",{signal:AbortSignal.timeout(1500)}).then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))' >/dev/null 2>&1; then
  ready=true
  break
 fi
 sleep 3
done
[[ "$ready" == true ]] || { echo "Core Host readiness failed" >&2; exit 4; }
docker exec "$new_cid" node -e 'fetch("http://127.0.0.1:8082/v1/tenants/4ab44379-d557-4df6-a2be-d44e121a8077/inbox/conversations",{signal:AbortSignal.timeout(3000)}).then(r=>process.exit(r.status===401?0:1)).catch(()=>process.exit(1))' >/dev/null ||
 { echo "Anonymous Inbox HTTP deny failed" >&2; exit 4; }
[[ "$(docker inspect --format '{{.State.Running}}' "$new_cid")" == true ]] || exit 4
verified=true
echo "CUTOVER_VERIFIED: Core Host image pinned to GitHub SHA; readiness 200; Inbox anonymous 401; toggles preserved"
echo "Product Gate remains OPEN: no authenticated Keycloak browser smoke or operational FGA grant/revocation proof"
