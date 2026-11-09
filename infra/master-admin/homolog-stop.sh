#!/usr/bin/env bash
# Stop ONLY the dedicated Platform Manager deployment and HTTPS Serve :9446.
# Never touch other Tailscale routes, Core Host, Workspace, databases or secrets.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
[[ "$PWD" == /home/delmacy/syndes-platform-manager-homolog ]] || {
  echo "BLOCKED: wrong checkout" >&2; exit 2;
}
[[ "$EUID" == 0 ]] || { echo "BLOCKED: root operator required" >&2; exit 2; }
runtime=/run/syndes/platform-manager
[[ -s "$runtime/deployed-head" ]] || {
  echo "BLOCKED: no successful Manager deploy marker; refusing blind shutdown" >&2; exit 2;
}
[[ -s "$runtime/master.env" && -s "$runtime/master-runtime.json" && -s "$runtime/master_db_url" ]] || {
  echo "BLOCKED: required Compose files missing; manual targeted recovery needed" >&2; exit 2;
}
export MASTER_API_ENV_FILE="$runtime/master.env"
export MASTER_RUNTIME_JSON="$runtime/master-runtime.json"
export MASTER_DB_URL_FILE="$runtime/master_db_url"
export MASTER_BIND_PORT=18085
# Stop a route ONLY if its structured configuration matches our own frontend.
route_gate="$PWD/infra/master-admin/check-tailnet-route.py"
if tailscale serve status --json 2>/dev/null | python3 "$route_gate" --mode active >/dev/null; then
  tailscale serve --bg --https=9446 off
elif tailscale serve status --json 2>/dev/null | python3 "$route_gate" --mode free >/dev/null; then
  echo "INFO: Manager HTTPS port already unallocated"
else
  echo "BLOCKED: port 9446 belongs to another route or has invalid configuration; refusing blind shutdown" >&2
  exit 2
fi
docker compose -f infra/master-admin/compose.yaml down --remove-orphans
rm -f "$runtime/deployed-head"
echo "STOPPED: only Platform Manager and Tailnet HTTPS 9446 (if present)"
echo "Control DB tables, roles, Keycloak client, dedicated networks and recovery backups preserved."
echo "Revoke platform operators and rotate DB secrets as separately audited actions if needed."
