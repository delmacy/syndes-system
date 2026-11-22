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
docker exec -i -u postgres "$db" psql -w -X -qAt -v ON_ERROR_STOP=1 \
  -U postgres -d syndes_control <<'SQL'
BEGIN;
DO $acl$
DECLARE
  row record;
  tenant_role text;
  mappings integer;
  processed integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname='syndes_master_api' AND rolcanlogin AND NOT rolsuper
  ) THEN
    RAISE EXCEPTION 'Manager role is absent or privileged';
  END IF;

  FOR row IN
    SELECT oid, datname FROM pg_database
    WHERE datname ~ '^syndes_tenant_[0-9a-f]{32}$'
    ORDER BY datname
  LOOP
    SELECT count(*), min(role_name)
      INTO mappings, tenant_role
      FROM public.tenant_registry WHERE database_name=row.datname;
    IF mappings <> 1
       OR tenant_role IS DISTINCT FROM
         ('syndes_t_' || substring(row.datname FROM 15))
       OR NOT EXISTS (
         SELECT 1 FROM pg_roles
         WHERE rolname=tenant_role AND rolcanlogin AND NOT rolsuper
       )
    THEN
      RAISE EXCEPTION 'Tenant database has no unambiguous restricted role mapping';
    END IF;

    -- Preserve the legitimate tenant login before revoking PUBLIC admission.
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', row.datname, tenant_role);
    EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', row.datname);

    IF has_database_privilege('syndes_master_api', row.oid, 'CONNECT')
       OR NOT has_database_privilege(tenant_role, row.oid, 'CONNECT')
    THEN
      RAISE EXCEPTION 'Tenant database isolation postcondition failed';
    END IF;
    processed := processed + 1;
  END LOOP;
  IF processed = 0 THEN
    RAISE EXCEPTION 'No tenant databases found; refusing silent success';
  END IF;
END
$acl$;
COMMIT;
SQL

echo 'MANAGER_TENANT_DATABASE_CONNECT_ISOLATION=PASS'
