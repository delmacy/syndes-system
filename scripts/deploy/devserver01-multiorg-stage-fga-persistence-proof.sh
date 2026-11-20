#!/usr/bin/env bash
# MO-REL-04: prove real OpenFGA store survives stage-only container recreation.
# Executed by Github Actions after central gate. No production access.
set -Eeuo pipefail
[[ "${1:-}" == prove && "$#" -eq 1 ]] || exit 2
[[ "${SYNDES_STAGE_FGA_RESTART_APPROVED:-}" == CI_APPROVED_MO_REL04 ]] || exit 2
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || exit 2
root=/home/delmacy/.local/share/syndes-multiorg-staging
project=syndes-multiorg-staging
[[ -d "$root" && -f "$root/compose.yaml" && ! -L "$root" ]] || exit 4
[[ "${SYNDES_STAGE_FGA_COMPOSE_SHA256:-}" =~ ^[0-9a-f]{64}$ ]] || exit 4
[[ "$(sha256sum "$root/compose.yaml" | cut -d' ' -f1)" == "$SYNDES_STAGE_FGA_COMPOSE_SHA256" ]] || exit 4
one() {
 local part="$1" ids
 local -a found
 mapfile -t found < <(docker ps -q \
   --filter "label=com.docker.compose.project=$project" \
   --filter "label=syndes.environment=multi-org-staging" \
   --filter "label=syndes.component=$part")
 [[ "${#found[@]}" == 1 ]] || return 4
 [[ "$(docker inspect -f '{{.State.Running}}' "${found[0]}")" == true ]] || return 4
 echo "${found[0]}"
}
pg="$(one control-postgres)" || exit 4
fga="$(one openfga)" || exit 4
[[ "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/openfga/config.yaml"}}yes{{end}}{{end}}' "$fga")" == yes ]] || {
 echo 'MO_REL04_FGA_RESTART_BLOCKED=config_mount';exit 4;
}
expected_hash="$(docker compose --project-name "$project" --file "$root/compose.yaml" config --hash openfga | awk '$1=="openfga" {print $2}')"
actual_hash="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.config-hash"}}' "$fga")"
[[ "$expected_hash" =~ ^[0-9a-f]{64}$ && "$actual_hash" == "$expected_hash" ]] || {
 echo 'MO_REL04_FGA_RESTART_BLOCKED=config_hash';exit 4;
}
db="$(docker exec "$pg" psql -X -At -U postgres -d postgres -v ON_ERROR_STOP=1 \
 -c "SELECT count(*) FROM pg_database WHERE datname='syndes_staging_openfga'")" || exit 4
[[ "$db" == 1 ]] || exit 4
name='syndes-stage-persistence-proof'
list_stores() {
  docker exec "$pg" sh -ec \
    'wget -q -T 10 -O - "http://openfga:8080/stores?name=syndes-stage-persistence-proof"' 2>/dev/null
}
parse_id() {
 python3 -c 'import json,sys; d=json.load(sys.stdin); s=[x.get("id","") for x in d.get("stores",[]) if x.get("name")=="syndes-stage-persistence-proof"]; print(s[0] if len(s)==1 else "")'
}
before="$(list_stores | parse_id)" || exit 4
if [[ -z "$before" ]]; then
  response="$(docker exec "$pg" sh -ec \
    'wget -q -T 10 --header "Content-Type: application/json" --post-data '\''{"name":"syndes-stage-persistence-proof"}'\'' -O - http://openfga:8080/stores' 2>/dev/null)" || exit 4
  before="$(printf '%s' "$response" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("id","") if d.get("name")=="syndes-stage-persistence-proof" else "")')" || exit 4
fi
[[ "$before" =~ ^[A-Z0-9]{20,32}$ ]] || {
 echo 'MO_REL04_FGA_RESTART_BLOCKED=fixture_not_created';exit 4;
}
echo 'MO_REL04_FGA_STAGE_STORE_CREATED_OR_REUSED'
docker compose --project-name "$project" --file "$root/compose.yaml" \
 up -d --force-recreate --no-deps --wait openfga >/dev/null
after="$(list_stores | parse_id)" || exit 5
[[ "$after" == "$before" ]] || {
 echo 'MO_REL04_FGA_RESTART_BLOCKED=store_not_persisted';exit 5;
}
fga="$(one openfga)" || exit 5
[[ "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/openfga/config.yaml"}}yes{{end}}{{end}}' "$fga")" == yes ]] || exit 5
echo 'MO_REL04_FGA_REAL_STORE_SURVIVES_RESTART_PASS_NOT_RESTORE'
