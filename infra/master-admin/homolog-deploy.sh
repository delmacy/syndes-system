#!/usr/bin/env bash
# DevServer01-only, isolated Platform Manager deployment.
# Fails before ANY mutation unless explicit role, secret, ownership and
# source-artifact conditions are met. Never deploys the old Workspace tree.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
repo="$(pwd -P)"
mode="${1:---preflight}"
[[ "$mode" == --preflight || "$mode" == --apply || "$mode" == --refresh-web ]] || {
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
[[ "$mode" != --refresh-web || "$actions_release" == true ]] || fail "Frontend refresh requires an Actions release"
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
if [[ "$mode" == --refresh-web ]]; then
  tailscale serve status --json 2>/dev/null | python3 "$repo/infra/master-admin/check-tailnet-route.py" --mode active >/dev/null ||
    fail "Manager Tailnet route does not match the running frontend"
  [[ -f "$runtime/deployed-head" && ! -L "$runtime/deployed-head" ]] ||
    fail "A successful Manager release is required before refreshing its frontend"
  deployed="$(cat "$runtime/deployed-head")"
  [[ "$deployed" =~ ^[a-f0-9]{40}$ ]] || fail "Invalid deployed Manager SHA"
  git -c safe.directory="$repo" diff --quiet "$deployed" "$head" -- apps/master-admin-api infra/master-admin/compose.yaml ||
    fail "Frontend refresh requires the deployed API and network configuration"
else
  tailscale serve status --json 2>/dev/null | python3 "$repo/infra/master-admin/check-tailnet-route.py" --mode free >/dev/null ||
    fail "Port 9447 already assigned or Tailscale configuration unreadable"
  if docker ps -q --filter 'label=com.docker.compose.project=syndes-master-admin' | grep -q .; then
    fail "Manager Compose already running; use the dedicated frontend refresh"
  fi
fi

say "All predeployment checks passed; source and approved CI artifact intact"
if [[ "$mode" == --preflight ]]; then
  echo "PREFLIGHT PASS: no changes made"
  exit 0
fi
umask 077
export MASTER_API_ENV_FILE="$runtime/master.env"
export MASTER_DB_URL_FILE="$runtime/master_db_url"
export MASTER_RUNTIME_JSON="$runtime/master-runtime.json"
export MASTER_BIND_PORT=18085
compose=(docker compose -f infra/master-admin/compose.yaml)
build_web(){
  docker build --pull=false --build-context "web-dist=$dist" \
    -f apps/master-admin-web/Dockerfile.runtime -t syndes/master-admin-web:local "$repo" >/dev/null
}
record_release(){
  local marker
  marker="$(mktemp "$runtime/.deployed-head.XXXXXXXX")"
  printf '%s\n' "$head" > "$marker"
  mv -f "$marker" "$runtime/deployed-head"
}
verify_web(){
  local id local_origin=http://127.0.0.1:18085 proxy_status
  id="$("${compose[@]}" ps -q master-web)"
  [[ "$id" =~ ^[a-f0-9]{12,64}$ ]] || fail "Expected one healthy Manager frontend"
  docker inspect -f '{{json (index .NetworkSettings.Ports "8080/tcp")}}' "$id" |
    jq -e '. == [{"HostIp":"127.0.0.1","HostPort":"18085"}]' >/dev/null ||
    fail "Manager frontend port is not published exclusively to host loopback"
  curl --noproxy '*' --fail --silent --show-error --max-time 5 "$local_origin/" >/dev/null ||
    fail "Manager frontend is healthy but unreachable on host loopback"
  curl --noproxy '*' --fail --silent --show-error --max-time 5 "$local_origin/master-runtime.json" |
    jq -e --arg issuer "$issuer" '.issuer == $issuer and .clientId == "syndes-master-admin"' >/dev/null ||
    fail "Manager runtime OIDC configuration is not served on host loopback"
  proxy_status="$(curl --noproxy '*' --silent --show-error --max-time 5 --output /dev/null --write-out '%{http_code}' \
    "$local_origin/v1/platform/admin/tenants")"
  [[ "$proxy_status" == 401 ]] || fail "Manager proxy did not deny anonymous tenant catalog access"
  say "Manager frontend healthy, loopback HTTP, OIDC configuration and API proxy verified"
}
verify_tailnet_http(){
  local anonymous_status
  curl --noproxy '*' --silent --show-error --fail --max-time 15 "$origin/" >/dev/null ||
    fail "Manager frontend not reachable through private HTTPS"
  anonymous_status=$(curl --noproxy '*' --silent --show-error --max-time 10 --output /dev/null --write-out '%{http_code}' \
    "$origin/v1/platform/admin/tenants")
  [[ "$anonymous_status" == 401 ]] || fail "Tenant catalog must deny anonymous requests"
  say "Private Manager frontend reachable and anonymous tenant catalog request denied"
}
if [[ "$mode" == --refresh-web ]]; then
  api_id="$("${compose[@]}" ps -q master-api)"
  web_id="$("${compose[@]}" ps -q master-web)"
  [[ "$api_id" =~ ^[a-f0-9]{12,64}$ && "$web_id" =~ ^[a-f0-9]{12,64}$ ]] ||
    fail "Expected the running Manager API and frontend"
  [[ "$(docker inspect -f '{{.State.Health.Status}}' "$api_id")" == healthy ]] ||
    fail "Manager API is unhealthy before frontend refresh"
  previous_web_image="$(docker inspect -f '{{.Image}}' "$web_id")"
  [[ "$previous_web_image" =~ ^sha256:[a-f0-9]{64}$ ]] || fail "Previous frontend image unavailable"
  build_web
  refresh_web(){
    "${compose[@]}" up -d --no-deps --no-build --force-recreate --wait --wait-timeout 60 master-web
  }
  rollback_web(){
    local status=$?
    if [[ $status -ne 0 ]]; then
      docker tag "$previous_web_image" syndes/master-admin-web:local && refresh_web ||
        echo "BLOCKED: previous Manager frontend image could not be restored" >&2
    fi
  }
  trap rollback_web EXIT
  refresh_web
  [[ "$("${compose[@]}" ps -q master-api)" == "$api_id" ]] ||
    fail "Manager API container changed during frontend refresh"
  verify_web
  verify_tailnet_http
  record_release
  trap - EXIT
  echo MANAGER_WEB_REFRESH_COMPLETE
  exit 0
fi

# Materialize non-secret OIDC configuration for the first deploy.
cat > "$MASTER_API_ENV_FILE" <<EOF
MASTER_KEYCLOAK_ISSUER=$issuer
MASTER_KEYCLOAK_AUDIENCE=syndes-master-api
MASTER_KEYCLOAK_CLIENT_ID=syndes-master-admin
MASTER_KEYCLOAK_JWKS_URL=http://keycloak:8080/realms/syndes/protocol/openid-connect/certs
MASTER_PUBLIC_ORIGIN=$origin
MASTER_CONTROL_DB_URL_FILE=/run/secrets/master_db_url
EOF
chmod 0600 "$MASTER_API_ENV_FILE"
printf '{"issuer":"%s","clientId":"syndes-master-admin"}\n' "$issuer" > "$MASTER_RUNTIME_JSON"
chmod 0644 "$MASTER_RUNTIME_JSON"
docker build --pull=false -f apps/master-admin-api/Dockerfile -t syndes/master-admin-api:local "$repo" >/dev/null
build_web
# Classify the exact connection boundary with NO application startup, secrets
# in environment, or tenant database touch. Both probes are disposable, under
# the approved Actions release; they execute SELECT only.
report_probe(){
  local scope="$1" output="$2" marker
  marker="$(printf '%s\n' "$output" | grep -Eo 'MANAGER_DB_PROBE=(PASS|BLOCKED:[a-z-]+:[A-Z0-9_]+:[a-z]+)' | tail -n 1 || true)"
  echo "MANAGER_${scope}_NETWORK_${marker:-PROBE=UNCLASSIFIED}"
  if [[ -z "$marker" ]]; then
    # Docker or Node failed before the one-shot JS probe could emit its marker.
    # Never log the captured error text (may contain daemon paths or metadata).
    local class=UNKNOWN
    case "$output" in
      *ERR_MODULE_NOT_FOUND*|*"Cannot find module"*) class=NODE_MODULE ;;
      *"invalid mount config"*|*"mount destination"*) class=MOUNT ;;
      *"OCI runtime create failed"*|*"OCI runtime exec failed"*) class=OCI_RUNTIME ;;
      *"permission denied"*|*"Permission denied"*) class=PERMISSION ;;
      *"network not found"*|*"network is unreachable"*) class=NETWORK ;;
      *"No such file or directory"*|*"no such file or directory"*) class=MISSING_FILE ;;
      *"unknown flag"*|*"invalid reference format"*) class=DOCKER_CLI ;;
      *"SyntaxError"*|*"ReferenceError"*) class=NODE_RUNTIME ;;
    esac
    echo "MANAGER_${scope}_DOCKER_FAILURE_CLASS=$class"
  fi
  [[ "$marker" == MANAGER_DB_PROBE=PASS ]]
}
if single_probe="$(docker run --rm --network syndes-master-data \
  --user 1000:1000 --read-only --cap-drop ALL --security-opt no-new-privileges \
  --mount "type=bind,src=$runtime/master_db_url,dst=/run/secrets/master_db_url,readonly" \
  -e MASTER_CONTROL_DB_URL_FILE=/run/secrets/master_db_url \
  --entrypoint node syndes/master-admin-api:local src/diagnostic-db.mjs 2>&1)"; then
  report_probe SINGLE "$single_probe" || fail "Single network Manager SQL probe returned no success marker"
else
  probe_exit=$?
  [[ "$probe_exit" =~ ^[0-9]+$ ]] || probe_exit=unknown
  echo "MANAGER_SINGLE_DOCKER_EXIT=$probe_exit"
  report_probe SINGLE "$single_probe" || true
  fail "Single-network Manager SQL probe failed; no Manager containers started"
fi
if multi_probe="$(docker compose -f infra/master-admin/compose.yaml \
  run -T --rm --no-deps --entrypoint node master-api src/diagnostic-db.mjs 2>&1)"; then
  report_probe MULTIHOMED "$multi_probe" || fail "Multihomed Manager SQL probe returned no success marker"
else
  probe_exit=$?
  [[ "$probe_exit" =~ ^[0-9]+$ ]] || probe_exit=unknown
  echo "MANAGER_MULTIHOMED_DOCKER_EXIT=$probe_exit"
  report_probe MULTIHOMED "$multi_probe" || true
  fail "Multihomed Manager SQL probe failed; no Manager containers started"
fi
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
      if [[ "$health" != healthy ]]; then
        api_log="$(docker logs --tail 80 "$api_id" 2>&1 || true)"
        marker="$(printf '%s\\n' "$api_log" | grep -Eo 'MASTER_API_STARTUP_FAILED=[A-Z0-9_]+' | tail -n 1 || true)"
        if [[ -n "$marker" ]]; then echo "$marker" >&2
        elif [[ "$api_log" == *EACCES* ]]; then echo 'MANAGER_API_STARTUP_FAILED=EACCES' >&2
        elif [[ "$api_log" == *ENOENT* ]]; then echo 'MANAGER_API_STARTUP_FAILED=ENOENT' >&2
        elif [[ "$api_log" == *ERR_MODULE_NOT_FOUND* ]]; then echo 'MANAGER_API_STARTUP_FAILED=ERR_MODULE_NOT_FOUND' >&2
        elif [[ "$api_log" == *"Missing MASTER_"* ]]; then echo 'MANAGER_API_STARTUP_FAILED=MISSING_CONFIGURATION' >&2
        else echo 'MANAGER_API_STARTUP_FAILED=UNCLASSIFIED' >&2; fi
      fi
    fi
    web_id="$(docker compose -f infra/master-admin/compose.yaml ps -aq master-web)"
    if [[ "$web_id" =~ ^[a-f0-9]{12,64}$ ]]; then
      state="$(docker inspect -f '{{.State.Status}}' "$web_id" 2>/dev/null || true)"
      health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$web_id" 2>/dev/null || true)"
      [[ "$state" =~ ^[a-z]+$ ]] || state=unknown
      [[ "$health" =~ ^[a-z]+$ ]] || health=unknown
      echo "MANAGER_WEB_CONTAINER_STATE=$state HEALTH=$health" >&2
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
docker compose -f infra/master-admin/compose.yaml up -d --no-build --wait --wait-timeout 90 ||
  fail "Manager containers did not become healthy"
verify_web
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
if [[ "$actions_release" == true ]]; then verify_tailnet_http; fi
record_release
started=false
echo "HOMOLOG_DEPLOY_COMPLETE: private Tailnet only; run read-only host gate and real login tests"
