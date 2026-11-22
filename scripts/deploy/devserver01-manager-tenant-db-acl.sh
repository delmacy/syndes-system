#!/usr/bin/env bash
# Repair only PostgreSQL tenant database CONNECT ACLs on the operational
# DevServer01 cluster. Invoked by the approved Manager GitHub Actions deploy.
# No role passwords, data rows, owners or application volumes are changed.
set -Eeuo pipefail
umask 077

[[ "${SYNDES_MANAGER_DEPLOY_APPROVAL:-}" == ACTIONS_APPROVED_MANAGER_FILE_DEPLOY ]] || exit 2
[[ "${SOURCE_SHA:-}" =~ ^[a-f0-9]{40}$ ]] || exit 2
[[ "$(id -un)" == delmacy && "$(id -u)" == 1000 && "$(hostname -s)" == DevServer01 ]] || exit 2

db=syndes-postgres-postgres-1
[[ "$(docker inspect "$db" --format '{{.State.Health.Status}}' 2>/dev/null)" == healthy ]] || exit 3

# Database privilege changes are transactional: if even one tenant mapping or
# postcondition fails, nothing from this reconciliation is committed.
sql="$(dirname "$0")/sql/manager-tenant-connect-acl.sql"
[[ -f "$sql" && ! -L "$sql" ]] || exit 3
docker exec -i -u postgres "$db" psql -w -X -qAt -v ON_ERROR_STOP=1 \
  -U postgres -d syndes_control < "$sql"

echo 'MANAGER_TENANT_DATABASE_CONNECT_ISOLATION=PASS'
