#!/usr/bin/env bash
# Trusted, side-effect-free tenant migration eligibility gate.
# Source from the operator installer after it validates TENANT_ID; this file
# intentionally does not read the control-plane DB or grant access to it.
syndes_module_migration_allowed(){
 local module="${1:-}" target="${2:-}" operational="${SYNDES_SUPPORT_TENANT_ID:-}"
 if [[ "$module" != support ]]; then return 0; fi
 if [[ ! "$operational" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$ ]];then
  echo "SKIP support migration: SYNDES_SUPPORT_TENANT_ID is not an approved canonical UUID" >&2
  return 1
 fi
 if [[ "$target" != "$operational" ]];then
  echo "SKIP support migration: target tenant is not the operational Syndes tenant" >&2
  return 1
 fi
 return 0
}
