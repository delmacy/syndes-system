#!/usr/bin/env bash
# Mutation exclusively executed by SHA-pinned GitHub Actions on isolated stage.
set -Eeuo pipefail
umask 077
[[ "$#" == 3 && "$1" == apply ]] || exit 2
[[ "${SYNDES_STAGE_RUNTIME_APPROVAL:-}" == ACTIONS_APPROVED_STAGE_RUNTIME ]] || exit 2
[[ "${SOURCE_SHA:-}" =~ ^[0-9a-f]{40}$ ]] || exit 2
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || exit 2
bundle="$2"; image="$3"
[[ "$image" == "syndes/core-host:stage-$SOURCE_SHA" ]] || exit 2
[[ -d "$bundle" && ! -L "$bundle" && "$(stat -c %a "$bundle")" == 700 ]] || exit 3
cd "$bundle"
sha256sum -c MANIFEST.sha256 --status || exit 3
root=/home/delmacy/.local/share/syndes-multiorg-staging
[[ -d "$root/secrets" && ! -L "$root" && ! -L "$root/secrets" && "$(stat -c %a "$root")" == 700 && "$(stat -c %a "$root/secrets")" == 700 ]] || exit 3
project=syndes-multiorg-staging
one(){
 local component="$1" cid
 cid="$(docker ps --no-trunc -q --filter "label=com.docker.compose.project=$project" --filter label=syndes.environment=multi-org-staging --filter "label=syndes.component=$component")"
 [[ "$cid" =~ ^[a-f0-9]{64}$ ]] || return 4
 printf '%s\n' "$cid"
}
pg="$(one control-postgres)"; kc="$(one keycloak)"; fga="$(one openfga)"
[[ "$(docker inspect -f '{{.Config.Image}}' "$pg")" == postgres:17-alpine ]] || exit 4
[[ "$(docker inspect -f '{{.Config.Image}}' "$kc")" == quay.io/keycloak/keycloak:26.8.1 ]] || exit 4
[[ "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/openfga/config.yaml"}}durable{{end}}{{end}}' "$fga")" == durable ]] || exit 4
docker image inspect "$image" >/dev/null
# Preserve an encrypted local baseline of the four stage databases. The key
# stays under the protected stage recovery directory; no backup/secret in logs.
mkdir -p -m 700 "$root/backups" "$root/runtime"
mkdir -p -m 755 "$root/runtime/tls"
if [[ ! -e "$root/secrets/backup-key" ]];then openssl rand -hex 32 > "$root/secrets/backup-key";chmod 600 "$root/secrets/backup-key";fi
for db in syndes_staging_control syndes_staging_keycloak syndes_staging_openfga syndes_tenant_1f5a8ce93f0148cca0132198d99e7510;do
 backup="$root/backups/$SOURCE_SHA-$db.dump.enc"
 if [[ ! -e "$backup" ]];then
  tmp="$(mktemp "$root/backups/.baseline.XXXXXXXX")"
  docker exec "$pg" pg_dump -U postgres -d "$db" -Fc | openssl enc -aes-256-cbc -pbkdf2 -salt -pass "file:$root/secrets/backup-key" -out "$tmp"
  [[ -s "$tmp" ]] || exit 4
  chmod 600 "$tmp";mv "$tmp" "$backup"
 fi
done
# Only newly generated stage certificate, retained across approved replays.
if [[ ! -e "$root/runtime/tls/server.key" && ! -e "$root/runtime/tls/server.crt" ]];then
 openssl req -x509 -newkey rsa:3072 -sha256 -nodes -days 365 \
  -keyout "$root/runtime/tls/server.key" -out "$root/runtime/tls/server.crt" \
  -subj '/CN=syndes-isolated-staging' \
  -addext 'subjectAltName=DNS:identity-stage,DNS:openbao-stage,DNS:localhost' >/dev/null 2>&1
 chmod 444 "$root/runtime/tls/server.key" "$root/runtime/tls/server.crt"
fi
[[ -s "$root/runtime/tls/server.key" && -s "$root/runtime/tls/server.crt" ]] || exit 4
for spec in runtime-compose.yaml identity.conf openbao.hcl;do
 [[ -f "$bundle/$spec" && ! -L "$bundle/$spec" ]] || exit 4
 if [[ -e "$root/runtime/$spec" && "$(sha256sum "$root/runtime/$spec" | cut -d' ' -f1)" != "$(sha256sum "$bundle/$spec" | cut -d' ' -f1)" ]];then
  cp "$root/runtime/$spec" "$root/runtime/$spec.previous-$SOURCE_SHA"
 fi
 cp "$bundle/$spec" "$root/runtime/$spec"
 chmod 644 "$root/runtime/$spec"
done
compose=(docker compose --project-name "$project" -f "$root/compose.yaml" -f "$root/runtime/runtime-compose.yaml")
"${compose[@]}" config --quiet
"${compose[@]}" up -d --no-deps openbao-stage </dev/null >/dev/null
# Recreate only isolated Keycloak if its pinned HTTPS hostname isn't applied.
if ! docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$kc" | grep -qx 'KC_HOSTNAME=https://identity-stage:8443';then
 "${compose[@]}" up -d --no-deps --force-recreate keycloak </dev/null >/dev/null
fi
"${compose[@]}" up -d --no-deps --force-recreate identity-stage </dev/null >/dev/null
# Administrative operator sidecar is ephemeral and never exposed as Core.
# Host recovery dir is 0700; runtime receives only specific read-only files.
operator_bundle="$root/runtime/operator-$SOURCE_SHA"
mkdir -p -m 700 "$operator_bundle"
cp "$bundle"/* "$operator_bundle/"
(cd "$operator_bundle" && sha256sum -c MANIFEST.sha256 --status) || exit 4
result="$(docker run --rm --user 0 --network syndes-multiorg-staging_staging_internal \
 --read-only --tmpfs /tmp:rw,nosuid,noexec,size=32m --cap-drop ALL --security-opt no-new-privileges \
 --mount "type=bind,src=$operator_bundle,dst=/run/bundle,readonly" \
 --mount "type=bind,src=$root/secrets,dst=/run/stage" \
 --mount "type=bind,src=$root/runtime/tls/server.crt,dst=/run/stage-ca.crt,readonly" \
 -e NODE_EXTRA_CA_CERTS=/run/stage-ca.crt -e SYNDES_STAGE_SETUP=ACTIONS_ISOLATED_STAGE_ONLY \
 -e "SOURCE_SHA=$SOURCE_SHA" --entrypoint node "$image" /run/bundle/setup.mjs </dev/null)"
printf '%s\n' "$result"
for marker in STAGE_RUNTIME_KEYCLOAK_HTTPS_ISSUER_JWKS_PASS STAGE_RUNTIME_RESTRICTED_KEYCLOAK_READER_READ_ALLOW_WRITE_DENY_PASS STAGE_RUNTIME_CORE_SQL_LOGIN_LEAST_PRIVILEGE_PASS STAGE_RUNTIME_OPENBAO_TLS_APPROLE_OWN_READ_PRODUCTION_CROSS_ROLE_DENY_REVOKE_PASS STAGE_RUNTIME_FOUNDATION_COMPLETE_NOT_CORE_HTTP;do
 printf '%s\n' "$result" | grep -qx "$marker"
done
