#!/usr/bin/env bash
# TEST-ONLY disposable OpenBao initialization. NEVER use its 1-of-1 unseal
# or short-lived root token in production.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
compose=(docker compose --env-file infra/.env.ci -f infra/security-access/compose.yaml)
cert="$PWD/infra/security-access/openbao/tls/server.crt"
if [[ ! -r "$cert" ]]; then echo "Disposable TLS certificate missing" >&2; exit 1; fi
bao_http() {
  docker run --rm -i --network syndes-secrets \
    -v "$cert:/tmp/trusted-ca.crt:ro" \
    curlimages/curl:8.12.1 --silent --show-error --cacert /tmp/trusted-ca.crt "$@"
}
# Verify TLS and the uninitialized, sealed lifecycle without trusting
# plain HTTP or disabling peer validation.
for attempt in $(seq 1 40); do
  if bao_http https://openbao:8200/v1/sys/health | python3 -c 'import json,sys; assert json.load(sys.stdin)["initialized"] is False' >/dev/null 2>&1; then
    break
  fi
  if [[ "$attempt" == 40 ]]; then echo "OpenBao TLS startup unavailable" >&2; exit 1; fi
  sleep 2
done
init_json=$("${compose[@]}" exec -T openbao bao operator init -key-shares=1 -key-threshold=1 -format=json)
unseal_key=$(jq -r '.unseal_keys_b64[0]' <<<"$init_json")
root_token=$(jq -r '.root_token' <<<"$init_json")
unset init_json
test -n "$unseal_key" && test -n "$root_token"
unseal() {
  printf '{"key":"%s"}' "$unseal_key" |
    bao_http --fail -X PUT -H 'Content-Type: application/json' --data-binary @- https://openbao:8200/v1/sys/unseal |
    jq -e '.sealed == false' >/dev/null
}
unseal
bao_http --fail -X POST -H "X-Vault-Token: $root_token" -H 'Content-Type: application/json' \
  --data '{"type":"kv","options":{"version":"2"}}' https://openbao:8200/v1/sys/mounts/kv >/dev/null
bao_http --fail -X POST -H "X-Vault-Token: $root_token" -H 'Content-Type: application/json' \
  --data '{"data":{"sentinel":"ci-only-openbao-raft"}}' https://openbao:8200/v1/kv/data/ci/smoke >/dev/null
read_sentinel() {
  bao_http --fail -H "X-Vault-Token: $root_token" https://openbao:8200/v1/kv/data/ci/smoke |
    jq -e '.data.data.sentinel == "ci-only-openbao-raft"' >/dev/null
}
read_sentinel
"${compose[@]}" restart openbao >/dev/null
for attempt in $(seq 1 40); do
  if bao_http https://openbao:8200/v1/sys/health |
    jq -e '.initialized == true and .sealed == true' >/dev/null 2>&1; then
    break
  fi
  if [[ "$attempt" == 40 ]]; then echo "OpenBao did not recover encrypted Raft after restart" >&2; exit 1; fi
  sleep 2
done
unseal
read_sentinel

# Smoke-test a restricted workload identity using a real AppRole and the
# compiled Core Host OpenBao client. Credentials are disposable CI-only.
bao_http --fail -X POST -H "X-Vault-Token: $root_token" -H 'Content-Type: application/json' \
  --data '{"type":"approle"}' https://openbao:8200/v1/sys/auth/approle >/dev/null
jq -Rs '{policy:.}' < infra/security-access/openbao/policies/core-host.hcl |
  bao_http --fail -X PUT -H "X-Vault-Token: $root_token" -H 'Content-Type: application/json' \
    --data-binary @- https://openbao:8200/v1/sys/policies/acl/core-host >/dev/null
bao_http --fail -X POST -H "X-Vault-Token: $root_token" -H 'Content-Type: application/json' \
  --data '{"token_policies":["core-host"],"token_ttl":"15m","token_max_ttl":"30m","token_no_default_policy":true}' \
  https://openbao:8200/v1/auth/approle/role/core-host >/dev/null
bao_http --fail -X POST -H "X-Vault-Token: $root_token" -H 'Content-Type: application/json' \
  --data '{"data":{"control_db_url":"ci-only-core-db-url","openfga_token":"ci-only-fga-key"}}' \
  https://openbao:8200/v1/kv/data/production/core-host >/dev/null
temp="$(mktemp -d)"
trap 'rm -rf "$temp"' EXIT
bao_http --fail -H "X-Vault-Token: $root_token" \
  https://openbao:8200/v1/auth/approle/role/core-host/role-id | jq -er '.data.role_id' > "$temp/role-id"
bao_http --fail -X POST -H "X-Vault-Token: $root_token" -H 'Content-Type: application/json' \
  --data '{}' https://openbao:8200/v1/auth/approle/role/core-host/secret-id |
  jq -er '.data.secret_id' > "$temp/secret-id"
chmod 0600 "$temp/role-id" "$temp/secret-id"
if [ ! -f apps/core-host/dist/secrets.js ]; then
  echo "Core Host TypeScript output not found for integration test" >&2
  exit 1
fi
docker run --rm --network syndes-secrets \
  -v "$PWD/apps/core-host/dist:/app:ro" \
  -v "$temp:/run/creds:ro" \
  -v "$cert:/etc/ssl/openbao-ca.crt:ro" \
  -e NODE_EXTRA_CA_CERTS=/etc/ssl/openbao-ca.crt \
  node:22-bookworm-slim node --input-type=module -e '
    import { loadCoreSecrets } from "/app/secrets.js";
    const values = await loadCoreSecrets({
      address: "https://openbao:8200",
      roleIdFile: "/run/creds/role-id",
      secretIdFile: "/run/creds/secret-id",
    });
    if (values.controlDbUrl !== "ci-only-core-db-url" ||
        values.openfgaToken !== "ci-only-fga-key") {
      throw new Error("OpenBao application credentials do not match");
    }
    console.log("Core Host AppRole -> OpenBao KV: PASS");
  '

unset unseal_key root_token
echo "OpenBao TLS, initialization, sealing, unsealing and encrypted Raft persistence: PASS"
