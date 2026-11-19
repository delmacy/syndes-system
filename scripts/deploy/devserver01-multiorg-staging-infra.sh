#!/usr/bin/env bash
# DevServer01 MO-REL-04: isolated PG17/Keycloak/OpenFGA foundation.
# Called ONLY by GitHub Actions via pinned Tailscale SSH after central CI.
# NEVER operates on operational Syndes compose/projects, networks or volumes.
set -Eeuo pipefail
umask 077
readonly mode="${1:-}"
readonly root="/home/delmacy/.local/share/syndes-multiorg-staging"
readonly secrets="$root/secrets"
readonly project="syndes-multiorg-staging"
[[ "$mode" == preflight || "$mode" == apply ]] && [[ $# -eq 1 ]] || {
 echo 'MO_REL04_STAGE_INFRA_DENY=unsupported_mode'; exit 2;
}
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || {
 echo 'MO_REL04_STAGE_INFRA_DENY=wrong_host'; exit 2;
}
for binary in docker df sha256sum openssl awk; do
 command -v "$binary" >/dev/null || {
  echo 'MO_REL04_STAGE_INFRA_BLOCKED=missing_dependency';exit 3;
 }
done
docker compose version >/dev/null
[[ ! -L "$root" && ! -L "$secrets" ]] || {
 echo 'MO_REL04_STAGE_INFRA_DENY=symlink';exit 3;
}
docker_root="$(docker info --format '{{.DockerRootDir}}')"
[[ "$docker_root" == /* && -d "$docker_root" ]] || {
 echo 'MO_REL04_STAGE_INFRA_BLOCKED=docker_root';exit 3;
}
free_kib="$(df -Pk "$docker_root" | awk 'NR==2 {print $4}')"
[[ "$free_kib" =~ ^[0-9]+$ ]] || exit 3
echo "MO_REL04_STAGE_INFRA_DISK_FREE_MIB=$((free_kib / 1024))"
(( free_kib >= 4194304 )) || {
 echo 'MO_REL04_STAGE_INFRA_BLOCKED=less_than_4gib';exit 4;
}
# Inspect only resources belonging to our exact Compose project. Any unknown
# colliding object is a hard error, never an invitation to replace it.
mapfile -t containers < <(docker ps -aq --filter "label=com.docker.compose.project=$project")
for cid in "${containers[@]}"; do
 [[ -z "$cid" ]] && continue
 label="$(docker inspect -f '{{index .Config.Labels "syndes.environment"}}' "$cid")"
 component="$(docker inspect -f '{{index .Config.Labels "syndes.component"}}' "$cid")"
 [[ "$label" == multi-org-staging ]] &&
  [[ "$component" =~ ^(control-postgres|keycloak|openfga)$ ]] || {
   echo 'MO_REL04_STAGE_INFRA_DENY=foreign_project_container';exit 4;
  }
done
if [[ "$mode" == preflight ]]; then
 echo 'MO_REL04_STAGE_INFRA_PREFLIGHT_PASS_NO_MUTATION'
 exit 0
fi
[[ "${SYNDES_STAGE_INFRA_APPLY:-}" == 'MO_REL04_CI_APPROVED' ]] || {
 echo 'MO_REL04_STAGE_INFRA_DENY=missing_ci_approval';exit 5;
}
[[ -d "$root" && -w "$root" && ! -L "$root" ]] || {
 echo 'MO_REL04_STAGE_INFRA_DENY=missing_stage_directory';exit 5;
}
for file in compose.yaml init-staging-postgres.sh; do
 [[ -f "$root/$file" && ! -L "$root/$file" && -r "$root/$file" ]] || {
  echo 'MO_REL04_STAGE_INFRA_DENY=missing_stage_artifact';exit 5;
 }
done
[[ "${SYNDES_STAGE_COMPOSE_SHA256:-}" =~ ^[0-9a-f]{64}$ ]] &&
[[ "${SYNDES_STAGE_INIT_SHA256:-}" =~ ^[0-9a-f]{64}$ ]] || {
 echo 'MO_REL04_STAGE_INFRA_DENY=missing_digest';exit 5;
}
[[ "$(sha256sum "$root/compose.yaml" | awk '{print $1}')" == "$SYNDES_STAGE_COMPOSE_SHA256" ]] &&
[[ "$(sha256sum "$root/init-staging-postgres.sh" | awk '{print $1}')" == "$SYNDES_STAGE_INIT_SHA256" ]] || {
 echo 'MO_REL04_STAGE_INFRA_DENY=artifact_drift';exit 5;
}
mkdir -p -m 0700 "$secrets"
[[ ! -L "$secrets" ]] || exit 5
create_secret() {
 local name="$1" path="$secrets/$name"
 [[ "$name" =~ ^(pg-admin|keycloak-db|keycloak-admin)$ ]] || exit 5
 if [[ -e "$path" || -L "$path" ]]; then
  [[ -f "$path" && ! -L "$path" && -r "$path" &&
    "$(stat -c %a "$path")" == 600 ]] || {
    echo 'MO_REL04_STAGE_INFRA_DENY=secret_permission';exit 5;
  }
 else
  local tmp
  tmp="$(mktemp "$secrets/.secret.XXXXXXXX")"
  openssl rand -hex 32 > "$tmp"
  chmod 0600 "$tmp"
  mv -n "$tmp" "$path"
  [[ ! -e "$tmp" ]] || { rm -f "$tmp";exit 5; }
 fi
}
create_secret pg-admin
create_secret keycloak-db
create_secret keycloak-admin
cd "$root"
# Fixed project: never use Compose from the working product checkout.
docker compose --project-name "$project" --file "$root/compose.yaml" config --quiet
docker compose --project-name "$project" --file "$root/compose.yaml" \
 up -d --wait control-postgres keycloak openfga
echo 'MO_REL04_STAGE_INFRA_PG17_KEYCLOAK_FGA_STARTED'
echo 'MO_REL04_STAGE_INFRA_NOT_G3_G4_G5_PROOF'
