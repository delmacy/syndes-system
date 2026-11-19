#!/usr/bin/env bash
# MO-REL-04 read-only inventory on an isolated Docker staging environment.
# Input and output carry no tenant identifiers, credentials, JWTs or SQL data.
set -Eeuo pipefail
[[ "${#}" -eq 1 && ( "${1:-}" == preflight || "${1:-}" == foundation ) ]] || {
  echo "STAGING_PREFLIGHT_DENY=invalid_mode";exit 2;
}
[[ "${SYNDES_STAGING_REMOTE_MODE:-}" == "read-only-v1" ]] || {
  echo "STAGING_PREFLIGHT_DENY=untrusted_execution";exit 2;
}
command -v docker >/dev/null || { echo "STAGING_PREFLIGHT_BLOCKED=docker_unavailable";exit 3; }
# Never start, stop, deploy, exec, alter, update, or inspect user data.
# Inspects Docker metadata for STAGING-labeled services only.
check() {
  local label="$1" expected="$2" count
  count="$(docker ps -q --filter "label=syndes.environment=multi-org-staging" \
    --filter "label=syndes.component=$label" | wc -l | tr -d '[:space:]')"
  [[ "$count" =~ ^[0-9]+$ ]] || { echo "STAGING_PREFLIGHT_BLOCKED=unexpected_inventory";return 1; }
  if [[ "$count" != "$expected" ]];then
    echo "STAGING_PREFLIGHT_BLOCKED=component_$label count_$count expected_$expected"
    return 1
  fi
  echo "STAGING_PREFLIGHT_OK=component_$label"
}
failed=0
check control-postgres 1 || failed=1
check keycloak 1 || failed=1
check openfga 1 || failed=1
if [[ "$1" == preflight ]]; then
 check core-host 1 || failed=1
fi
# Exactly one labeled Core Host: separate from product lease, not a substitute
# for the PG Control singleton test or no-external-producer evidence.
if ((failed));then
 echo "MO_REL04_STAGING_PREFLIGHT=BLOCKED"
 exit 4
fi
echo "MO_REL04_STAGING_COMPONENT_INVENTORY_PASS"
echo "MO_REL04_STAGING_PREFLIGHT_ONLY=NO_SQL_NO_GRANTS_NO_DEPLOY_NO_CUTOVER"
