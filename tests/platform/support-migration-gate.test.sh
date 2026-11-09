#!/usr/bin/env bash
# Run without Docker, keys or real tenant databases. Negative tests are mandatory.
set -Eeuo pipefail
source "$(dirname "$0")/../../infra/postgres/bootstrap/support-migration-gate.sh"
S="11111111-1111-4111-8111-111111111111"
C="22222222-2222-4222-8222-222222222222"
assert_denied(){
 if syndes_module_migration_allowed support "$1" >/dev/null 2>&1; then
  echo "SECURITY: Support migration incorrectly accepted" >&2
  exit 1
 fi
}
unset SYNDES_SUPPORT_TENANT_ID || :
assert_denied "$S"
export SYNDES_SUPPORT_TENANT_ID=invalid
assert_denied "$S"
export SYNDES_SUPPORT_TENANT_ID="$S"
assert_denied "$C"
syndes_module_migration_allowed support "$S" || { echo "Approved Support migration blocked" >&2; exit 1; }
unset SYNDES_SUPPORT_TENANT_ID
syndes_module_migration_allowed crm "$C" || { echo "Existing CRM migration blocked" >&2; exit 1; }
syndes_module_migration_allowed inbox "$C"
syndes_module_migration_allowed organizations "$C"
syndes_module_migration_allowed whatsapp "$C"
# The production installer must use the tested helper before emitting module SQL.
script="$(dirname "$0")/../../infra/postgres/bootstrap/migrate-modules-tenant.sh"
grep -qF 'source "$script_dir/support-migration-gate.sh"' "$script"
grep -qF 'syndes_module_migration_allowed "$module" "$TENANT_ID"' "$script"
echo "Support-only operational tenant migration gate: PASS"
