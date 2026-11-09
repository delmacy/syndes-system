#!/usr/bin/env bash
# This is a MOCKED operator-installer contract test. No Docker or PG connection.
# It proves that the installer invokes the actual migration gate before SQL emission.
set -Eeuo pipefail
repo="$(cd "$(dirname "$0")/../.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cat > "$tmp/docker" <<'BASH'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "${1:-}" == "run" ]]; then
 if [[ " $* " == *" --list "* ]]; then
  printf '%s\n' '[{"id":"crm","migrations":["001_crm_foundation"]},{"id":"support","migrations":["001_support_cases"]}]'
 elif [[ " $* " == *" --emit "* ]]; then
  printf '%s\n' "-- emitted migration ${@: -2:1}"
 else
  echo "unexpected docker run arguments" >&2;exit 1
 fi
elif [[ "${1:-}" == "compose" && " $* " == *" syndes_control "* ]]; then
 printf 'syndes_tenant_%s\n' "${TENANT_ID//-/}"
elif [[ "${1:-}" == "compose" && " $* " == *" psql "* ]]; then
 cat >> "${SYNDES_E2E_INSTALLER_LOG:?}"
else
 echo "unexpected docker arguments" >&2;exit 1
fi
BASH
cat > "$tmp/jq" <<'BASH'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "${1:-}" == "-e" ]];then cat >/dev/null; exit 0; fi
if [[ "${1:-}" == "-r" ]];then
 printf 'crm\t001_crm_foundation\nsupport\t001_support_cases\n'
else echo "unexpected jq invocation" >&2;exit 1;fi
BASH
chmod +x "$tmp/docker" "$tmp/jq"
export PATH="$tmp:$PATH"
export SYNDES_CORE_HOST_IMAGE="ghcr.io/syndes/core-host@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
export SYNDES_E2E_INSTALLER_LOG="$tmp/emissions.log"
S="11111111-1111-4111-8111-111111111111"
C="22222222-2222-4222-8222-222222222222"
export TENANT_ID="$C"
export SYNDES_CORE_HOST_IMAGE="ghcr.io/syndes/core-host:mutable"
if bash "$repo/infra/postgres/bootstrap/migrate-modules-tenant.sh" >"$tmp/mutable.log" 2>&1;then
 echo "CRITICAL: mutable Core Host image allowed for privileged tenant migrations" >&2;exit 1
fi
export SYNDES_CORE_HOST_IMAGE="ghcr.io/syndes/core-host@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
run_case(){
 export TENANT_ID="$1"
 : > "$SYNDES_E2E_INSTALLER_LOG"
 bash "$repo/infra/postgres/bootstrap/migrate-modules-tenant.sh" > "$tmp/stdout.log"
}
export SYNDES_SUPPORT_TENANT_ID="$S"
run_case "$C"
grep -q 'crm' "$tmp/stdout.log"
if grep -q 'support' "$tmp/stdout.log";then echo "Support installed in commercial tenant" >&2;exit 1;fi
grep -q 'crm' "$SYNDES_E2E_INSTALLER_LOG"
if grep -q 'support' "$SYNDES_E2E_INSTALLER_LOG";then echo "Support SQL emitted for commercial tenant" >&2;exit 1;fi
run_case "$S"
grep -q 'support' "$tmp/stdout.log" || { echo "Support not applied to Syndes operational tenant" >&2;exit 1; }
grep -q 'support' "$SYNDES_E2E_INSTALLER_LOG" || { echo "Support SQL not emitted for Syndes" >&2;exit 1; }
unset SYNDES_SUPPORT_TENANT_ID
run_case "$S"
if grep -q 'support' "$SYNDES_E2E_INSTALLER_LOG";then echo "Support SQL emitted without approved tenant setting" >&2;exit 1;fi
echo "Operator installer cannot emit Support SQL into commercial tenants: PASS"
