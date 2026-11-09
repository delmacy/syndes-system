#!/usr/bin/env bash
# DevServer01-only, isolated Platform Manager deployment.
# Fails before ANY mutation unless explicit role, secret, ownership and
# source-artifact conditions are met. Never deploys the old Workspace tree.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
repo="$PWD"
mode="${1:---preflight}"
[[ "$mode" == --preflight || "$mode" == --apply ]] || {
  echo "Usage: homolog-deploy.sh --preflight|--apply" >&2; exit 2;
}
fail(){ echo "BLOCKED: $*" >&2; exit 2; }
say(){ echo "GATE: $*"; }
[[ "$repo" == /home/delmacy/syndes-platform-manager-homolog ]] ||
  fail "Run only in the isolated DevServer01 homologation checkout"
command -v docker >/dev/null || fail "Docker unavailable"
command -v jq >/dev/null || fail "jq unavailable"
command -v tailscale >/dev/null || fail "Tailscale unavailable"
[[ "$(docker inspect syndes-postgres-postgres-1 --format '{{.State.Health.Status}}' 2>/dev/null)" == healthy ]] ||
  fail "Shared PostgreSQL not healthy"
[[ "$(docker inspect syndes-security-access-keycloak-1 --format '{{.State.Status}}' 2>/dev/null)" == running ]] ||
  fail "Keycloak unavailable"
for net in syndes-master-data syndes-master-identity; do
  [[ "$(docker network inspect "$net" --format '{{.Internal}}' 2>/dev/null)" == true ]] ||
    fail "Approved internal network absent: $net"
done

role_sql="SELECT count(*) FROM pg_authid WHERE rolname='syndes_master_api' AND rolpassword IS NOT NULL"
owner_sql="SELECT count(*) FROM platform_operator_access WHERE role='owner' AND state='active'"
dbcheck(){ docker exec -u postgres syndes-postgres-postgres-1 psql -w -X -v ON_ERROR_STOP=1 -U postgres -d syndes_control -tAc "$1" 2>/dev/null; }
[[ "$(dbcheck "$role_sql")" == 1 ]] || fail "Runtime DB password not provisioned"
[[ "$(dbcheck "$owner_sql")" =~ ^[1-9][0-9]*$ ]] || fail "No explicitly approved platform owner"
[[ "$(docker exec syndes-security-access-openbao-1 bao status -format=json 2>/dev/null | jq -r '.initialized and ( .sealed | not )')" == true ]] ||
  fail "OpenBao is sealed or unavailable"

runtime=/run/syndes/platform-manager
if [[ $EUID -ne 0 ]]; then
  fail "Apply/preflight require root operator to inspect root-only tmpfs secrets"
fi
[[ "$(findmnt -T /run -no FSTYPE)" == tmpfs ]] ||
  fail "Runtime secrets must reside on /run tmpfs"
[[ -f "$runtime/master_db_url" ]] || fail "OpenBao-rendered Control DB secret missing"
[[ "$(stat -c %a "$runtime")" == 700 ]] || fail "Runtime secret directory permissions invalid"
[[ "$(stat -c %a "$runtime/master_db_url")" == 600 ]] || fail "DB secret file mode invalid"
[[ "$(stat -c %u "$runtime/master_db_url")" == 1000 ]] || fail "DB secret must be readable only by Node's UID"
[[ "$(grep -c '@syndes-control-postgres:5432/syndes_control?' "$runtime/master_db_url")" == 1 ]] ||
  fail "DB credential targets wrong database"

manifest="$repo/artifacts/web-dist/CI_ARTIFACT_MANIFEST.json"
[[ -f "$manifest" && -f "$repo/artifacts/web-dist/index.html" ]] ||
  fail "Missing CI-built static frontend artifact"
source_sha=$(jq -er '.git_commit' "$manifest") || fail "Artifact provenance unavailable"
head=$(git -c safe.directory="$repo" -C "$repo" rev-parse HEAD)
[[ "$head" =~ ^[a-f0-9]{40}$ && "$source_sha" =~ ^[a-f0-9]{40}$ ]] ||
  fail "Invalid source/artifact SHA"
git -c safe.directory="$repo" -C "$repo" cat-file -e "$source_sha^{commit}" ||
  fail "CI artifact commit is not in repo history"
git -c safe.directory="$repo" -C "$repo" diff --quiet "$source_sha" "$head" -- \
  apps/master-admin-web/src/ apps/master-admin-web/public/ \
  apps/master-admin-web/index.html apps/master-admin-web/vite.config.ts \
  apps/master-admin-web/package.json apps/master-admin-web/package-lock.json ||
  fail "Frontend source changed after validated CI artifact; rebuild it in CI"
[[ -z "$(git -c safe.directory="$repo" -C "$repo" status --porcelain --untracked-files=no)" ]] ||
  fail "Tracked source has uncommitted changes"
# Validate private HTTPS host and OIDC issuer, no network changes yet.
dns=$(tailscale status --json | jq -er '.Self.DNSName' | sed 's/\.$//')
[[ "$dns" =~ ^[A-Za-z0-9.-]+\.ts\.net$ ]] || fail "Tailnet HTTPS identity not available"
origin="https://$dns:9446"
issuer=$(curl --fail --silent --show-error --max-time 5 \
  http://127.0.0.1:18080/realms/syndes/.well-known/openid-configuration | jq -er '.issuer')
[[ "$issuer" == "https://$dns:9444/realms/syndes" ]] ||
  fail "Keycloak issuer does not match approved Tailnet host"
if tailscale serve status 2>/dev/null | grep -Fq ':9446 (tailnet only)'; then
  fail "Port 9446 already configured; avoid replacing another Serve handler"
fi
if docker ps -q --filter 'label=com.docker.compose.project=syndes-master-admin' | grep -q .; then
  fail "Manager Compose already running; use the dedicated gate, not redeployment"
fi

say "All predeployment checks passed; source and approved CI artifact intact"
if [[ "$mode" == --preflight ]]; then
  echo "PREFLIGHT PASS: no changes made"
  exit 0
fi
# Never write a DB password, token or AppRole to env, log or Git.
umask 077
cat > "$runtime/master.env" <<EOF
MASTER_KEYCLOAK_ISSUER=$issuer
MASTER_KEYCLOAK_AUDIENCE=syndes-master-api
MASTER_KEYCLOAK_CLIENT_ID=syndes-master-admin
MASTER_KEYCLOAK_JWKS_URL=http://keycloak:8080/realms/syndes/protocol/openid-connect/certs
MASTER_PUBLIC_ORIGIN=$origin
MASTER_CONTROL_DB_URL_FILE=/run/secrets/master_db_url
EOF
chmod 0600 "$runtime/master.env"
printf '{"issuer":"%s","clientId":"syndes-master-admin"}\n' "$issuer" > "$runtime/master-runtime.json"
chmod 0644 "$runtime/master-runtime.json"
docker build --pull=false -f apps/master-admin-api/Dockerfile -t syndes/master-admin-api:local "$repo" >/dev/null
docker build --pull=false --build-context web-dist=artifacts/web-dist \
  -f apps/master-admin-web/Dockerfile.runtime -t syndes/master-admin-web:local "$repo" >/dev/null
export MASTER_API_ENV_FILE="$runtime/master.env"
export MASTER_DB_URL_FILE="$runtime/master_db_url"
export MASTER_RUNTIME_JSON="$runtime/master-runtime.json"
export MASTER_BIND_PORT=18085
started=true
rollback_on_error(){
  result=$?
  if [[ "$result" -ne 0 && "$started" == true ]]; then
    echo "HOMOLOG DEPLOY FAILED: rolling back only the isolated Manager stack" >&2
    if tailscale serve status 2>/dev/null | grep -Fq ':9446 (tailnet only)'; then
      tailscale serve --bg --https=9446 off || true
    fi
    docker compose -f infra/master-admin/compose.yaml down --remove-orphans || true
  fi
}
trap rollback_on_error EXIT
docker compose -f infra/master-admin/compose.yaml up -d --no-build
for n in $(seq 1 30); do
  if curl --silent --fail --max-time 2 http://127.0.0.1:18085/ >/dev/null; then break; fi
  if [[ $n == 30 ]]; then fail "Isolated frontend did not become healthy; inspect only Manager stack"; fi
  sleep 2
done
# Save the current Serve configuration for an operator recovery review.
# Never reset or overwrite the existing 8443, 9443 or 9444 handlers.
tailscale serve get-config "$runtime/tailscale-before-manager.json"
chmod 0600 "$runtime/tailscale-before-manager.json"
# Tailnet HTTPS only (never funnel/public internet), no reset of existing routes.
tailscale serve --bg --https=9446 http://127.0.0.1:18085
tailscale serve status | grep -Fq ':9446 (tailnet only)' ||
  fail "Tailnet Serve did not bind to the dedicated HTTPS port"
printf '%s\n' "$head" > "$runtime/deployed-head"
chmod 0600 "$runtime/deployed-head"
started=false
echo "HOMOLOG_DEPLOY_COMPLETE: private Tailnet only; run read-only host gate and real login tests"
