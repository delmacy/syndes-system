#!/usr/bin/env bash
# Compatibility wrapper; CRM migrations now come from installed package metadata.
set -Eeuo pipefail
exec "$(dirname "$0")/migrate-modules-tenant.sh" "$@"
