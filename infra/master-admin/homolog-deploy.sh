#!/usr/bin/env bash
# DevServer01-only, isolated Platform Manager deployment.
# Fails before ANY mutation unless explicit role, secret, ownership and
# source-artifact conditions are met. Never deploys the old Workspace tree.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
repo="$(pwd -P)"
mode="${1:---preflight}"
[[ "$mode" == --preflight || "$mode" == --apply ]] || {
  echo "Usage: homolog-deploy.sh --preflight|--apply" >&2; exit 2;
}
fail(){ echo "BLOCKED: $*" >&2; exit 2; }
say(){ echo "GATE: $*"; }
actions_release=false
case "$repo" in
  /home/delmacy/syndes-platform-manager-homolog|/home/delmacy/syndes-platform-manager-release) ;;
  /home/delmacy/.local/share/syndes-platform-manager/release)
    [[ "${SYNDES_MANAGER_DEPLOY_APPROVAL:-}" == ACTIONS_APPROVED_MANAGER_FILE_DEPLOY &&
      "$EUID" == 1000 && "$(hostname -s)" == DevServer01 ]] || fail "Actions release requires the DevServer01 deployment account"
    actions_release=true
    ;;
  *) fail "Run only in an explicitly approved DevServer01 Manager release checkout" ;;
esac
command -v docker >/dev/null || fail "Docker unavailable"
command -v jq >/dev/null || fail "jq unavailable"
command -v tailscale >/dev/null || fail "Tailscale unavailable"
command -v python3 >/dev/null || fail "Python 3 unavailable"
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
runtime=/run/syndes/platform-manager
dist="$repo/artifacts/web-dist"
if [[ "$actions_release" == true ]]; then
  runtime=/home/delmacy/.local/share/syndes-platform-manager/runtime
  dist="${SYNDES_MANAGER_WEB_DIST:?Actions must provide the validated frontend artifact}"
else
  [[ "$EUID" == 0 ]] || fail "Legacy runtime requires the root operator"
  [[ "$(findmnt -T /run -no FSTYPE)" == tmpfs ]] || fail "Legacy runtime must reside on /run tmpfs"
fi
[[ -f "$runtime/master_db_url" && ! -L "$runtime/master_db_url" ]] || fail "Dedicated Control DB secret missing"
[[ ! -L "$runtime" && "$(stat -c %a "$runtime")" == 700 ]] || fail "Runtime secret directory permissions invalid"
[[ "$(stat -c %a "$runtime/master_db_url")" == 600 ]] || fail "DB secret file mode invalid"
[[ "$(stat -c %u "$runtime/master_db_url")" == 1000 ]] || fail "DB secret must be readable only by Node's UID"
[[ "$(grep -c '@syndes-control-postgres:5432/syndes_control?' "$runtime/master_db_url")" == 1 ]] ||
  fail "DB credential targets wrong database"

manifest="$dist/CI_ARTIFACT_MANIFEST.json"
[[ -f "$manifest" && -f "$dist/index.html" ]] ||
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
  apps/master-admin-web/package.json apps/master-admin-web/package-lock.json \
  packages/front-shared/ ||
  fail "Frontend source changed after validated CI artifact; rebuild it in CI"
[[ -z "$(git -c safe.directory="$repo" -C "$repo" status --porcelain --untracked-files=no)" ]] ||
  fail "Tracked source has uncommitted changes"
# Validate private HTTPS host and OIDC issuer, no network changes yet.
dns=$(tailscale status --json | jq -er '.Self.DNSName' | sed 's/\.$//')
[[ "$dns" =~ ^[A-Za-z0-9.-]+\.ts\.net$ ]] || fail "Tailnet HTTPS identity not available"
origin="https://$dns:9447"
issuer=$(curl --fail --silent --show-error --max-time 5 \
  http://127.0.0.1:18080/realms/syndes/.well-known/openid-configuration | jq -er '.issuer')
[[ "$issuer" == "https://$dns:9444/realms/syndes" ]] ||
  fail "Keycloak issuer does not match approved Tailnet host"
if [[ "$actions_release" == true ]]; then
  login_status=$(curl --silent --show-error --max-time 10 --output /dev/null --write-out '%{http_code}' --get \
    --data-urlencode client_id=syndes-master-admin --data-urlencode "redirect_uri=$origin/" \
    --data-urlencode response_type=code --data-urlencode scope=openid \
    --data-urlencode code_challenge_method=S256 \
    --data-urlencode code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM \
    http://127.0.0.1:18080/realms/syndes/protocol/openid-connect/auth)
  [[ "$login_status" == 200 ]] || fail "Keycloak did not accept the dedicated 9447 Manager login request"
fi
if ! tailscale serve status --json 2>/dev/null | python3 "$repo/infra/master-admin/check-tailnet-route.py" --mode free >/dev/null; then
  fail "Port 9447 already assigned or Tailscale configuration unreadable; do not overwrite"
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
docker build --pull=false --build-context "web-dist=$dist" \
  -f apps/master-admin-web/Dockerfile.runtime -t syndes/master-admin-web:local "$repo" >/dev/null
export MASTER_API_ENV_FILE="$runtime/master.env"
export MASTER_DB_URL_FILE="$runtime/master_db_url"
export MASTER_RUNTIME_JSON="$runtime/master-runtime.json"
export MASTER_BIND_PORT=18085
started=true
route_owned=false
rollback_on_error(){
  result=$?
  if [[ "$result" -ne 0 && "$started" == true ]]; then
    # Classify the failing isolated API without revealing logs, env or DSNs.
    api_id="$(docker ps -aq --filter label=com.docker.compose.project=syndes-master-admin --filter label=com.docker.compose.service=master-api | head -n 1)"
    if [[ "$api_id" =~ ^[a-f0-9]{12,64}$ ]]; then
      state="$(docker inspect -f '{{.State.Status}}' "$api_id" 2>/dev/null || true)"
      code="$(docker inspect -f '{{.State.ExitCode}}' "$api_id" 2>/dev/null || true)"
      health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$api_id" 2>/dev/null || true)"
      [[ "$state" =~ ^[a-z]+$ ]] || state=unknown
      [[ "$code" =~ ^[0-9]+$ ]] || code=unknown
      [[ "$health" =~ ^[a-z]+$ ]] || health=unknown
      echo "MANAGER_API_CONTAINER_STATE=$state EXIT=$code HEALTH=$health" >&2
      api_log="$(docker logs --tail 80 "$api_id" 2>&1 || true)"
      marker="$(printf '%s\\n' "$api_log" | grep -Eo 'MASTER_API_STARTUP_FAILED=[A-Z0-9_]+' | tail -n 1 || true)"
      if [[ -n "$marker" ]]; then echo "$marker" >&2
      elif [[ "$api_log" == *EACCES* ]]; then echo 'MANAGER_API_STARTUP_FAILED=EACCES' >&2
      elif [[ "$api_log" == *ENOENT* ]]; then echo 'MANAGER_API_STARTUP_FAILED=ENOENT' >&2
      elif [[ "$api_log" == *ERR_MODULE_NOT_FOUND* ]]; then echo 'MANAGER_API_STARTUP_FAILED=ERR_MODULE_NOT_FOUND' >&2
      elif [[ "$api_log" == *"Missing MASTER_"* ]]; then echo 'MANAGER_API_STARTUP_FAILED=MISSING_CONFIGURATION' >&2
      else echo 'MANAGER_API_STARTUP_FAILED=UNCLASSIFIED' >&2; fi
    fi
    echo "HOMOLOG DEPLOY FAILED: rolling back only the isolated Manager stack" >&2
    if [[ "$route_owned" == true ]] &&
       tailscale serve status --json 2>/dev/null | python3 "$repo/infra/master-admin/check-tailnet-route.py" --mode active >/dev/null 2>&1; then
      tailscale serve --bg --https=9447 off || true
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
tailscale serve status --json > "$runtime/tailscale-before-manager.json"
chmod 0600 "$runtime/tailscale-before-manager.json"
# Never replace another operator's HTTPS route; recheck immediately before binding.
tailscale serve status --json 2>/dev/null | python3 "$repo/infra/master-admin/check-tailnet-route.py" --mode free >/dev/null ||
  fail "Port 9447 changed during deploy; refusing to overwrite another application"
# Tailnet HTTPS only (never funnel/public internet), no reset of existing routes.
tailscale serve --bg --https=9447 http://127.0.0.1:18085
route_owned=true
tailscale serve status --json 2>/dev/null | python3 "$repo/infra/master-admin/check-tailnet-route.py" --mode active >/dev/null ||
  fail "Tailnet Serve route does not point to the dedicated Manager frontend"
if [[ "$actions_release" == true ]]; then
  curl --silent --show-error --fail --max-time 15 "$origin/" >/dev/null ||
    fail "Manager frontend not reachable through private HTTPS"
  anonymous_status=$(curl --silent --show-error --max-time 10 --output /dev/null --write-out '%{http_code}' \
    "$origin/v1/platform/admin/tenants")
  [[ "$anonymous_status" == 401 ]] || fail "Tenant catalog must deny anonymous requests"
  say "Private Manager frontend reachable and anonymous tenant catalog request denied"
fi
printf '%s\n' "$head" > "$runtime/deployed-head"
chmod 0600 "$runtime/deployed-head"
started=false
echo "HOMOLOG_DEPLOY_COMPLETE: private Tailnet only; run read-only host gate and real login tests"
