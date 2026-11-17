#!/usr/bin/env bash
# DevServer01 Core Host: GitHub Actions CD only. preflight is read-only.
set -Eeuo pipefail

readonly project='syndes-whatsapp-cutover'
readonly service='core-host-whatsapp'
readonly compose_dir='/home/delmacy/syndes-system/modules/whatsapp/deploy'
readonly managed_override="$compose_dir/.syndes-core-host-cd.override.yaml"
readonly manifest_files=(
  '/home/delmacy/syndes-system/modules/whatsapp/deploy/devserver01-cutover.compose.yaml'
  '/home/delmacy/syndes-releases/inbox-receipts-scroll-20261104/core-r2.override.yaml'
  '/home/delmacy/syndes-releases/org-scope-8e2fb5d-20261109/release-override.compose.yaml'
  '/home/delmacy/syndes-releases/inbox-assignment-4126665/release-override.compose.yaml'
)
# Ordered SHA256 lock of four operational Compose manifests. Update only after review.
readonly manifest_sha256=(
  'b0d1a94dcf00de7129aeb118b027dd161fb6047c22516affa2031b8c53e2220f'
  '62fae023cfb0db70e64243588b9139cadf1b662f1912c82f059feb861714d6b9'
  'b003f8f0fb57d4d2d2df895bf1fcf13bf07b200f5fdc7f0eae7dfa1ab35b0e9c'
  'abe594ab53d3bd7947a15386f915d005313a13ccd4d0477256cbfb91c6908955'
)

mode="${1:-}"
[[ "$mode" == preflight || "$mode" == deploy ]] || { echo 'Expected preflight or deploy' >&2; exit 2; }
if [[ "$mode" == preflight ]]; then
  [[ $# -eq 1 ]] || exit 2
else
  [[ $# -eq 2 ]] || exit 2
  image="$2"
  [[ "$image" =~ ^syndes/core-host:git-[0-9a-f]{40}$ ]] || { echo 'Image must be pinned to GitHub SHA' >&2; exit 2; }
fi
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || {
  echo 'Unexpected remote identity: refuse release' >&2; exit 2;
}
for program in docker sha256sum mktemp; do command -v "$program" >/dev/null || exit 2; done
[[ ${#manifest_files[@]} -eq 4 && ${#manifest_files[@]} -eq ${#manifest_sha256[@]} ]] || exit 2
[[ -d "$compose_dir" && ! -L "$compose_dir" ]] || exit 3
cd "$compose_dir"
compose_args=(--project-name "$project")
for index in "${!manifest_files[@]}"; do
  path="${manifest_files[$index]}"
  expected="${manifest_sha256[$index]}"
  [[ -f "$path" && -r "$path" && ! -L "$path" ]] || { echo 'Compose manifest missing or symlinked' >&2; exit 3; }
  actual="$(sha256sum "$path" | awk '{print $1}')"
  [[ "$actual" == "$expected" ]] || { echo "Compose manifest drift at index $index; refusing" >&2; exit 3; }
  compose_args+=(--file "$path")
done
compose_base() { docker compose "${compose_args[@]}" "$@"; }
compose_release() { docker compose "${compose_args[@]}" --file "$managed_override" "$@"; }
compose_base version >/dev/null
compose_base config --quiet >/dev/null 2>&1 || { echo 'Base Compose config invalid' >&2; exit 3; }
compose_base config --services | grep -Fxq "$service" || { echo 'Core Host Compose service missing' >&2; exit 3; }

old_cid="$(compose_base ps -q "$service")"
[[ -n "$old_cid" && "$old_cid" != *$'\n'* ]] || { echo 'Exactly one existing Core Host container required' >&2; exit 3; }
previous="$(docker inspect --format '{{.Config.Image}}' "$old_cid")"
[[ "$previous" == syndes/core-host:* ]] || { echo 'Unexpected existing image' >&2; exit 3; }
[[ "$(docker inspect --format '{{.State.Running}}' "$old_cid")" == true ]] || { echo 'Core Host must already be running' >&2; exit 3; }
docker image inspect "$previous" >/dev/null || { echo 'Previous image unavailable for safe rollback' >&2; exit 3; }
[[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$old_cid")" == "$project" ]] || exit 3
[[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "$old_cid")" == "$service" ]] || exit 3

env_value() {
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$1" |
    awk -v prefix="$2=" 'index($0,prefix)==1 {print substr($0,length(prefix)+1);exit}'
}
old_dispatch="$(env_value "$old_cid" WHATSAPP_DISPATCH_ENABLED)"
old_multi="$(env_value "$old_cid" SYNDES_MULTI_ORG_ENABLED)"
[[ "$old_multi" != true ]] || { echo 'Multi-org rollout outside scope' >&2; exit 3; }

# Pre-existing override may contain ONLY one service image, consistent with the live container.
expected_override() { printf 'services:\n  %s:\n    image: %s\n' "$service" "$1"; }
if [[ -e "$managed_override" || -L "$managed_override" ]]; then
  [[ -f "$managed_override" && ! -L "$managed_override" ]] || exit 3
  cmp -s "$managed_override" <(expected_override "$previous") || {
    echo 'Managed override drifted from currently running image' >&2; exit 3;
  }
  compose_release config --quiet >/dev/null 2>&1 || { echo 'Managed Compose config invalid' >&2; exit 3; }
fi

if [[ "$mode" == preflight ]]; then
  echo 'DEVSERVER01_COMPOSE_READONLY_PREFLIGHT_PASS: 4 locked manifests, scoped Core Host service'
  exit 0
fi

docker image inspect "$image" >/dev/null || { echo 'Approved image missing after transfer' >&2; exit 3; }
new_image_id="$(docker image inspect --format '{{.Id}}' "$image")"
old_image_id="$(docker inspect --format '{{.Image}}' "$old_cid")"
[[ -n "$new_image_id" && -n "$old_image_id" ]] || exit 3

# --no-deps must preserve the container IDs of all other services.
mapfile -t other_services < <(compose_base config --services | grep -Fxv "$service" || true)
other_cids=()
for other in "${other_services[@]}"; do other_cids+=("$(compose_base ps -q "$other")"); done

write_override() {
  local target_image="$1" tmp
  tmp="$(mktemp "${managed_override}.XXXXXXXX")" || return 1
  chmod 600 "$tmp" || { rm -f "$tmp"; return 1; }
  expected_override "$target_image" > "$tmp" || { rm -f "$tmp"; return 1; }
  mv -fT -- "$tmp" "$managed_override"
}

switched=false
verified=false
rollback_on_failure() {
  local result=$?
  trap - EXIT
  if [[ "$switched" == true && "$verified" != true ]]; then
    echo 'Core Host cutover failed: attempting image-only rollback' >&2
    if write_override "$previous" && compose_release up -d --no-deps --force-recreate "$service"; then
      restored="$(compose_release ps -q "$service")"
      if [[ -n "$restored" && "$(docker inspect --format '{{.Image}}' "$restored")" == "$old_image_id" && "$(docker inspect --format '{{.State.Running}}' "$restored")" == true ]]; then
        echo 'ROLLBACK_CORE_HOST_RESTORED' >&2
      else
        echo 'ROLLBACK_UNVERIFIED: operator intervention required' >&2
      fi
    else
      echo 'ROLLBACK_FAILED: operator intervention required' >&2
    fi
  fi
  exit "$result"
}
trap rollback_on_failure EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Atomic persistent image-only fifth override. The four existing manifests remain unchanged.
switched=true
write_override "$image"
compose_release config --quiet >/dev/null 2>&1 || { echo 'Candidate Compose config invalid' >&2; exit 4; }
compose_release up -d --no-deps --force-recreate "$service"
new_cid="$(compose_release ps -q "$service")"
[[ -n "$new_cid" && "$new_cid" != *$'\n'* ]] || { echo 'Core Host missing after cutover' >&2; exit 4; }
[[ "$(docker inspect --format '{{.Image}}' "$new_cid")" == "$new_image_id" ]] || { echo 'Unexpected image ID after cutover' >&2; exit 4; }
[[ "$(docker inspect --format '{{.State.Running}}' "$new_cid")" == true ]] || exit 4
[[ "$(env_value "$new_cid" WHATSAPP_DISPATCH_ENABLED)" == "$old_dispatch" ]] || { echo 'Dispatch toggle changed' >&2; exit 4; }
[[ "$(env_value "$new_cid" SYNDES_MULTI_ORG_ENABLED)" == "$old_multi" ]] || { echo 'Multi-org toggle changed' >&2; exit 4; }
for index in "${!other_services[@]}"; do
  [[ "$(compose_release ps -q "${other_services[$index]}")" == "${other_cids[$index]}" ]] || {
    echo 'Non-target Compose service changed' >&2; exit 4;
  }
done

ready=false
for attempt in $(seq 1 20); do
  if docker exec "$new_cid" node -e 'fetch("http://127.0.0.1:8082/readyz",{signal:AbortSignal.timeout(1500)}).then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))' >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 3
done
[[ "$ready" == true ]] || { echo 'Core Host readiness failed' >&2; exit 4; }
docker exec "$new_cid" node -e 'fetch("http://127.0.0.1:8082/v1/tenants/4ab44379-d557-4df6-a2be-d44e121a8077/inbox/conversations",{signal:AbortSignal.timeout(3000)}).then(r=>process.exit(r.status===401?0:1)).catch(()=>process.exit(1))' >/dev/null 2>&1 || { echo 'Anonymous Inbox HTTP deny failed' >&2; exit 4; }
verified=true
echo 'CUTOVER_VERIFIED: image SHA, readiness 200, anonymous Inbox 401, toggles and other Compose services preserved'
echo 'Product Gate remains OPEN: authenticated Keycloak and FGA grants/revocation not yet demonstrated'
