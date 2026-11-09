#!/usr/bin/env bash
set -Eeuo pipefail
set -a
source infra/.env.ci
set +a
# Exercises the real OpenFGA model against a disposable CI store.
fga() {
  docker run --rm --network syndes-security-access \
    -v "$PWD/infra/security-access/fga-model.json:/model.json:ro" \
    curlimages/curl:8.12.1 -fsS --max-time 15 \
    -H "Authorization: Bearer $OPENFGA_PRESHARED_KEY" \
    -H "Content-Type: application/json" "$@"
}
store_json=$(fga -X POST -d '{"name":"syndes-ci-smoke"}' http://openfga:8080/stores)
store_id=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])' <<< "$store_json")
model_json=$(fga -X POST --data-binary @/model.json "http://openfga:8080/stores/$store_id/authorization-models")
python3 -c 'import json,sys; assert json.load(sys.stdin)["authorization_model_id"]' <<< "$model_json"

a="4ab44379-d557-4df6-a2be-d44e121a8077"
b="d21930aa-f4f6-40c0-bb1a-e71d7bb92caa"
ra=$(printf "%s|%s" "$a" "person:42" | sha256sum | cut -d" " -f1)
rb=$(printf "%s|%s" "$b" "person:42" | sha256sum | cut -d" " -f1)
fga -X POST -d "{\"writes\":{\"tuple_keys\":[
 {\"user\":\"user:alice\",\"relation\":\"member\",\"object\":\"tenant:$a\"},
 {\"user\":\"tenant:$a\",\"relation\":\"tenant\",\"object\":\"resource:$ra\"},
 {\"user\":\"tenant:$b\",\"relation\":\"tenant\",\"object\":\"resource:$rb\"}
]}}" "http://openfga:8080/stores/$store_id/write" >/dev/null

check() {
  local user="$1" relation="$2" object="$3" expected="$4"
  response=$(fga -X POST -d "{\"tuple_key\":{\"user\":\"user:$user\",\"relation\":\"$relation\",\"object\":\"$object\"}}" "http://openfga:8080/stores/$store_id/check")
  python3 -c 'import json,sys; assert json.load(sys.stdin)["allowed"] == (sys.argv[1]=="true")' "$expected" <<< "$response"
}
check alice can_read "resource:$ra" true
check alice can_write "resource:$ra" false
check alice can_read "resource:$rb" false
check bob can_read "resource:$ra" false
echo "OpenFGA model: grants expected access, denies cross-tenant and unauthorized writes."
