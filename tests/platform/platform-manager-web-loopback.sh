#!/usr/bin/env bash
# Exercise the release Compose with a disposable upstream and the CI web image.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
tmp="$(mktemp -d)"
project="manager-web-ci-$$"
export MASTER_API_ENV_FILE="$tmp/master.env"
export MASTER_DB_URL_FILE="$tmp/db-placeholder"
export MASTER_RUNTIME_JSON="$tmp/master-runtime.json"
export MASTER_BIND_PORT=18087
touch "$MASTER_API_ENV_FILE" "$MASTER_DB_URL_FILE"
printf '%s\n' '{"issuer":"https://id.example.test/realms/syndes","clientId":"syndes-master-admin"}' > "$MASTER_RUNTIME_JSON"
chmod 0644 "$MASTER_RUNTIME_JSON"
cat > "$tmp/compose.yaml" <<'YAML'
services:
  master-api:
    image: python:3.12-alpine
    user: "1000:1000"
    entrypoint: [python3, -c]
    command:
      - |
        from http.server import HTTPServer, BaseHTTPRequestHandler
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(401 if self.path == "/v1/platform/admin/tenants" else 404)
                self.end_headers()
        HTTPServer(("0.0.0.0", 8085), Handler).serve_forever()
    healthcheck:
      test: [CMD, python3, -c, "import socket; socket.create_connection(('127.0.0.1',8085), 1).close()"]
      interval: 1s
  master-web:
    image: syndes/master-admin-web:runtime-ci
networks:
  syndes-master-data: {external: false, internal: true}
  syndes-master-identity: {external: false, internal: true}
YAML
compose=(docker compose -p "$project" -f infra/master-admin/compose.yaml -f "$tmp/compose.yaml")
cleanup(){
  "${compose[@]}" down >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT
"${compose[@]}" up -d --no-build --wait --wait-timeout 75
id="$("${compose[@]}" ps -q master-web)"
docker inspect -f '{{json (index .NetworkSettings.Ports "8080/tcp")}}' "$id" |
  jq -e --arg port "$MASTER_BIND_PORT" '. == [{"HostIp":"127.0.0.1","HostPort":$port}]' >/dev/null
base="http://127.0.0.1:$MASTER_BIND_PORT"
probe(){ curl --noproxy '*' --silent --show-error --max-time 4 "$@"; }
probe --fail "$base/" >/dev/null
probe --fail "$base/master-runtime.json" | cmp - "$MASTER_RUNTIME_JSON"
[[ "$(probe --output /dev/null --write-out '%{http_code}' "$base/v1/platform/admin/tenants")" == 401 ]]
echo MANAGER_WEB_LOOPBACK_RUNTIME_JSON_AND_PROXY_PASS
