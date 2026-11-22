#!/usr/bin/env bash
# Install the CI-validated Manager on its dedicated private endpoint.
set -Eeuo pipefail
umask 077
[[ "${SYNDES_MANAGER_DEPLOY_APPROVAL:-}" == ACTIONS_APPROVED_MANAGER_FILE_DEPLOY ]] || exit 2
[[ "$(id -un)" == delmacy && "$(id -u)" == 1000 && "$(hostname -s)" == DevServer01 ]] || exit 2
[[ "${SOURCE_SHA:-}" =~ ^[a-f0-9]{40}$ ]] || exit 2
dist="$(realpath "${1:?missing CI bundle}")"
[[ -f "$dist/index.html" && "$(jq -er .git_commit "$dist/CI_ARTIFACT_MANIFEST.json")" == "$SOURCE_SHA" ]] || exit 3

root=/home/delmacy/.local/share/syndes-platform-manager
release="$root/release"
[[ "$(realpath -m "$release")" == "$release" ]] || exit 3
mkdir -p "$root"
[[ "$(stat -c '%u:%a' "$root")" == 1000:700 ]] || exit 3
exec 9>"$root/deploy.lock"
flock -n 9

repo=https://github.com/delmacy/syndes-system.git
[[ "$(git ls-remote "$repo" refs/heads/main | cut -f1)" == "$SOURCE_SHA" ]] || exit 3
if [[ ! -d "$release/.git" ]]; then
  [[ ! -e "$release" ]] || exit 3
  git init --quiet "$release"
fi
[[ "$(stat -c '%u:%a' "$release")" == 1000:700 ]] || exit 3
[[ -z "$(git -C "$release" status --porcelain)" ]] || exit 3
git -C "$release" fetch --quiet --depth=1 "$repo" "$SOURCE_SHA"
git -C "$release" checkout --quiet --detach "$SOURCE_SHA"
[[ "$(git -C "$release" rev-parse HEAD)" == "$SOURCE_SHA" ]] || exit 3

python3 "$release/infra/master-admin/provision-db-file.py" --apply
SYNDES_MANAGER_WEB_DIST="$dist" bash "$release/infra/master-admin/homolog-deploy.sh" --apply
