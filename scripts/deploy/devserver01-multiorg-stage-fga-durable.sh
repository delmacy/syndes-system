#!/usr/bin/env bash
# MO-REL-04 CI-only stage FGA persistent transition. NEVER operational stack.
set -Eeuo pipefail
umask 077
mode="${1:-}"
[[ "$#" -eq 1 && ( "$mode" == preflight || "$mode" == apply ) ]] || exit 2
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || exit 2
[[ "${SYNDES_STAGE_FGA_DURABLE_APPROVAL:-}" == CI_APPROVED_MO_REL04 ]] || exit 2
for command in docker sha256sum openssl stat awk; do command -v "$command" >/dev/null || exit 3; done
root=/home/delmacy/.local/share/syndes-multiorg-staging
project=syndes-multiorg-staging
[[ -d "$root" && -d "$root/secrets" && ! -L "$root" && ! -L "$root/secrets" ]] || exit 4
[[ "$(stat -c %a "$root")" == 700 && "$(stat -c %a "$root/secrets")" == 700 ]] || exit 4
one() {
  local component="$1" cid
  local -a matches
  mapfile -t matches < <(docker ps -q \
    --filter "label=com.docker.compose.project=$project" \
    --filter "label=syndes.environment=multi-org-staging" \
    --filter "label=syndes.component=$component")
  [[ "${#matches[@]}" == 1 ]] || { echo "MO_REL04_FGA_DENY=missing_$component";return 4; }
  cid="${matches[0]}"
  [[ "$(docker inspect -f '{{.State.Running}}' "$cid")" == true ]] || exit 4
  printf '%s\n' "$cid"
}
pg="$(one control-postgres)" || exit 4
fga="$(one openfga)" || exit 4
one keycloak >/dev/null || exit 4
# Strictly forbid any migration of existing in-memory stores.
# On replay after migration, the target has a config mount and we must not
# require it to be empty (grants/models will eventually be durable).
mounted="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/openfga/config.yaml"}}persistent{{end}}{{end}}' "$fga")"
if [[ "$mounted" != persistent ]]; then
  data="$(docker exec "$pg" sh -ec 'wget -q -T 7 -O - http://openfga:8080/stores' 2>/dev/null)" || exit 4
  # Parse only a count, never print store contents.
  store_count="$(printf '%s' "$data" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(len(d.get("stores",[])) if not d.get("continuation_token") else -1)')" || exit 4
  [[ "$store_count" == 0 ]] || {
    echo 'MO_REL04_FGA_DENY=nonempty_memory_store';exit 4;
  }
fi
echo 'MO_REL04_FGA_STAGE_PRECONDITIONS_PASS'
[[ "$mode" == apply ]] || exit 0
[[ "${SYNDES_STAGE_FGA_COMPOSE_SHA256:-}" =~ ^[0-9a-f]{64}$ ]] || exit 5
[[ "$(sha256sum "$root/compose.yaml" | awk '{print $1}')" == "$SYNDES_STAGE_FGA_COMPOSE_SHA256" ]] || {
  echo 'MO_REL04_FGA_DENY=compose_drift'; exit 5;
}
secret="$root/secrets/openfga-db-password"
cfg="$root/secrets/openfga-config.yaml"
if [[ ! -e "$secret" && ! -L "$secret" ]]; then
  tmp="$(mktemp "$root/secrets/.openfga-secret.XXXXXXXX")"
  openssl rand -hex 32 > "$tmp"
  chmod 0600 "$tmp"
  mv -n "$tmp" "$secret"
  [[ ! -e "$tmp" ]] || { rm -f "$tmp";exit 5; }
fi
[[ -f "$secret" && ! -L "$secret" && "$(stat -c %a "$secret")" == 600 ]] || exit 5
password="$(cat "$secret")"
[[ "$password" =~ ^[0-9a-f]{64}$ ]] || exit 5
# No password on process argv, stdout, Docker env or GitHub logs.
state="$(docker exec "$pg" psql -X -At -U postgres -d postgres \
 -v ON_ERROR_STOP=1 -c "SELECT (SELECT count(*) FROM pg_roles WHERE rolname='syndes_staging_openfga')::text || ':' || (SELECT count(*) FROM pg_database WHERE datname='syndes_staging_openfga')::text")" || exit 5
case "$state" in
  0:0)
    { printf '\\set fga_password %s\n' "$password"; cat <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE',
 'syndes_staging_openfga', :'fga_password') \gexec
CREATE DATABASE syndes_staging_openfga OWNER syndes_staging_openfga;
SQL
    } | docker exec -i "$pg" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 >/dev/null
    ;;
  1:1) ;;
  *) echo 'MO_REL04_FGA_DENY=partial_pg_catalog';exit 5;;
esac
[[ "$(docker exec "$pg" psql -X -At -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
 "SELECT (SELECT count(*) FROM pg_roles WHERE rolname='syndes_staging_openfga')::text || ':' || (SELECT count(*) FROM pg_database WHERE datname='syndes_staging_openfga')::text")" == 1:1 ]] || exit 5
# The config file is readable by the OpenFGA container uid 65532 via a
# read-only Compose config. The entire hosting directory is 0700 so other
# host users cannot traverse to the file; DB password file stays 0600.
if [[ ! -e "$cfg" && ! -L "$cfg" ]]; then
  tmp="$(mktemp "$root/secrets/.openfga-config.XXXXXXXX")"
  printf 'datastore:\n  engine: postgres\n  uri: "postgres://syndes_staging_openfga:%s@control-postgres:5432/syndes_staging_openfga?sslmode=disable"\nauthn:\n  method: none\nplayground:\n  enabled: false\nmetrics:\n  enabled: false\n' "$password" > "$tmp"
  chmod 0644 "$tmp"
  mv -n "$tmp" "$cfg"
  [[ ! -e "$tmp" ]] || { rm -f "$tmp";exit 5; }
fi
[[ -f "$cfg" && ! -L "$cfg" && "$(stat -c %a "$cfg")" == 644 ]] || exit 5
# Compare secret-derived YAML without ever printing its contents.
expected="$(printf 'datastore:\n  engine: postgres\n  uri: "postgres://syndes_staging_openfga:%s@control-postgres:5432/syndes_staging_openfga?sslmode=disable"\nauthn:\n  method: none\nplayground:\n  enabled: false\nmetrics:\n  enabled: false\n' "$password" | sha256sum | cut -d' ' -f1)"
[[ "$(sha256sum "$cfg" | cut -d' ' -f1)" == "$expected" ]] || {
  echo 'MO_REL04_FGA_DENY=config_drift';exit 5;
}
unset password
cd "$root"
docker compose --project-name "$project" --file "$root/compose.yaml" config --quiet
# Only schema migration against the new, dedicated staging OpenFGA DB.\n# The script arrives over bash -s stdin; Docker Compose MUST NOT inherit it.\n# Otherwise Compose consumes the remaining deployment instructions, silently\n# making a partial migration look like a successful deployment.
docker compose --project-name "$project" --file "$root/compose.yaml" \
  run -T --rm --no-deps openfga-migrate </dev/null >/dev/null
echo 'MO_REL04_FGA_POSTGRES_MIGRATION_PASS'
# Recreate ONLY OpenFGA, never PG, Keycloak, operational core or other tenants.
# Force recreation is scoped to the exact verified staging OpenFGA service.
# Compose v5 may report up/health success while retaining an old memory-backed
# container. Health alone MUST NEVER be accepted as durable configuration.
docker compose --project-name "$project" --file "$root/compose.yaml" \
  up -d --force-recreate --no-deps --wait openfga </dev/null >/dev/null
mapfile -t running < <(docker ps -q \
  --filter "label=com.docker.compose.project=$project" \
  --filter "label=syndes.environment=multi-org-staging" \
  --filter "label=syndes.component=openfga")
[[ "${#running[@]}" == 1 ]] || {
  echo 'MO_REL04_FGA_BLOCKED=post_deploy_container_count';exit 5;
}
current="${running[0]}"
mount="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/openfga/config.yaml"}}postgres_config{{end}}{{end}}' "$current")"
[[ "$mount" == postgres_config ]] || {
  echo 'MO_REL04_FGA_BLOCKED=post_deploy_config_mount';exit 5;
}
expected_hash="$(docker compose --project-name "$project" --file "$root/compose.yaml" config --hash openfga | awk '$1=="openfga" {print $2}')"
actual_hash="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.config-hash"}}' "$current")"
[[ "$expected_hash" =~ ^[0-9a-f]{64}$ && "$actual_hash" == "$expected_hash" ]] || {
  echo 'MO_REL04_FGA_BLOCKED=post_deploy_config_hash';exit 5;
}
physical_tables="$(docker exec "$pg" psql -X -At -U postgres -d syndes_staging_openfga -v ON_ERROR_STOP=1 \
  -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")" || exit 5
[[ "$physical_tables" =~ ^[0-9]+$ && "$physical_tables" -ge 5 ]] || {
  echo 'MO_REL04_FGA_BLOCKED=post_deploy_schema';exit 5;
}
docker exec "$pg" sh -ec 'wget -q -T 10 -O - http://openfga:8080/healthz >/dev/null' || exit 5
echo 'MO_REL04_FGA_POST_DEPLOY_CONFIG_HASH_MOUNT_SCHEMA_HTTP_PASS_NOT_RESTORE'
