#!/usr/bin/env bash
# Real, disposable infrastructure/identity integration gate.
# This consolidates the security scenarios formerly isolated in core-host-infra.yml.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."

postgres_compose() {
  docker compose --env-file infra/.env.ci -f infra/postgres/compose.yaml "$@"
}
security_compose() {
  docker compose --env-file infra/.env.ci -f infra/security-access/compose.yaml "$@"
}
host_compose() {
  docker compose --env-file infra/.env.ci -f apps/core-host/compose.yaml "$@"
}

temp_dir="$(mktemp -d)"
cleanup() {
  host_compose down --remove-orphans >/dev/null 2>&1 || true
  security_compose down -v --remove-orphans >/dev/null 2>&1 || true
  postgres_compose down -v --remove-orphans >/dev/null 2>&1 || true
  sudo rm -rf /run/syndes/runtime /run/syndes/approle 2>/dev/null || true
  rm -rf "$temp_dir" infra/security-access/openbao/tls/server.key \
    infra/security-access/openbao/tls/server.crt
}
trap cleanup EXIT

echo "Validate production-like network and secret isolation with CI-only fixtures"
docker network inspect syndes-data >/dev/null 2>&1 || docker network create --internal syndes-data >/dev/null
sudo install -d -m 0700 -o "$(id -u)" -g "$(id -g)" /run/syndes /run/syndes/runtime
python3 tests/platform/ci-secret-fixtures.py

bash -n infra/postgres/bootstrap/00-init.sh infra/postgres/bootstrap/provision-tenant.sh
for script in tests/platform/*.sh; do bash -n "$script"; done
postgres_compose config --quiet
security_compose config --quiet
host_compose config --quiet
python3 -m json.tool infra/security-access/fga-model.json >/dev/null
postgres_compose config --format json > "$temp_dir/postgres.json"
security_compose config --format json > "$temp_dir/security.json"
host_compose config --format json > "$temp_dir/host.json"

python3 - "$temp_dir" <<'PY'
import json
from pathlib import Path
import sys

root = Path(sys.argv[1])
read = lambda p: json.loads((root / p).read_text(encoding="utf-8"))
host = read("host.json")["services"]["core-host"]
forbidden_host = {"CORE_CONTROL_DB_URL", "CORE_OPENFGA_TOKEN", "OPENFGA_PRESHARED_KEY"}
assert not forbidden_host.intersection(host.get("environment", {})), "Host secrets exposed in environment"
host_secrets = {entry.get("source") for entry in host.get("secrets", [])}
assert {"core_host_role_id", "core_host_secret_id"}.issubset(host_secrets), "Missing AppRole file secrets"
for cfg in (read("postgres.json"), read("security.json")):
    forbidden = {"POSTGRES_PASSWORD", "PG_KEYCLOAK_PASSWORD", "PG_OPENFGA_PASSWORD",
                 "PG_CORE_PASSWORD", "KC_DB_PASSWORD", "KC_BOOTSTRAP_ADMIN_PASSWORD",
                 "OPENFGA_DATASTORE_URI", "OPENFGA_AUTHN_PRESHARED_KEYS"}
    for name, service in cfg["services"].items():
        assert not forbidden.intersection(service.get("environment", {})), f"Secret in env: {name}"
keycloak = read("security.json")["services"]["keycloak"]
assert "--config-file=/run/secrets/keycloak.conf" in keycloak["command"]
assert any(secret.get("target") == "keycloak.conf" for secret in keycloak["secrets"])
print("Host, database, Keycloak and OpenFGA secret boundaries: PASS")
PY

echo "Provision real disposable PostgreSQL service and two tenant roles"
postgres_compose up -d postgres
bash tests/platform/postgres-smoke.sh

echo "Build trusted Core Host for the real AppRole integration"
(cd packages/core-kernel && npm ci --no-audit --no-fund && npm run build)
for module in modules/organizations modules/core-crm modules/inbox modules/whatsapp modules/support; do
  if [[ -f "$module/package-lock.json" ]]; then
    (cd "$module" && npm ci --no-audit --no-fund && npm run build)
  fi
done
(cd apps/core-host && npm ci --no-audit --no-fund && npm run build)

echo "Launch disposable Keycloak, OpenFGA and OpenBao with private network"
mkdir -p infra/security-access/openbao/tls
openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 1 \
  -keyout infra/security-access/openbao/tls/server.key \
  -out infra/security-access/openbao/tls/server.crt \
  -subj "/CN=openbao" \
  -addext "subjectAltName=DNS:openbao,DNS:localhost,IP:127.0.0.1" >/dev/null 2>&1
chmod 0644 infra/security-access/openbao/tls/server.key
security_compose up -d

set -a
source infra/.env.ci
set +a
for attempt in $(seq 1 25); do
  if docker run --rm --network syndes-security-access curlimages/curl:8.12.1 \
    -fsS --max-time 3 http://keycloak:9000/health/ready >/dev/null 2>&1; then break; fi
  if [[ "$attempt" -eq 25 ]]; then echo "::error::Keycloak readiness failed" >&2; exit 1; fi
  sleep 3
done
for attempt in $(seq 1 40); do
  if docker run --rm --network syndes-security-access curlimages/curl:8.12.1 \
    -fsS --max-time 3 -H "Authorization: Bearer $OPENFGA_PRESHARED_KEY" \
    http://openfga:8080/stores >/dev/null 2>&1; then break; fi
  if [[ "$attempt" -eq 40 ]]; then echo "::error::OpenFGA readiness failed" >&2; exit 1; fi
  sleep 2
done

bash tests/platform/openbao-smoke.sh
bash tests/platform/openfga-smoke.sh

# Later modules may add a real bootable Core Host smoke suite.
if [[ -f tests/platform/core-host-runtime-smoke.sh ]]; then
  CI_RUNTIME_SMOKE=1 bash tests/platform/core-host-runtime-smoke.sh
fi

echo "Syndes real PostgreSQL + identity/isolation CI gate: PASS"
