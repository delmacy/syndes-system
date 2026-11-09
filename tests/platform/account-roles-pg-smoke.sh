#!/usr/bin/env bash
# Issue #49: real PostgreSQL proof in an exclusively disposable container.
# Never point this at a persistent database; no host sockets or ports exposed.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
image="${ACCOUNT_ROLES_TEST_PG_IMAGE:-postgres:17-alpine}"
case "$image" in
  postgres:17-alpine|postgres:17-bookworm) ;;
  *) echo "Unexpected PostgreSQL CI fixture image" >&2; exit 2;;
esac
container="syndes-account-access-ci-${GITHUB_RUN_ID:-local}-$$"
cleanup(){ docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run --rm --network none --detach --name "$container" \
  -e POSTGRES_PASSWORD=disposable-account-role-ci-only "$image" >/dev/null
for attempt in $(seq 1 40); do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres -d postgres >/dev/null 2>&1; then break; fi
  if [[ $attempt == 40 ]]; then echo "Disposable PostgreSQL not ready" >&2; exit 1; fi
  sleep 1
done
sql(){ docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d syndes_control "$@"; }
scalar(){ sql -tAc "$1" | tr -d '\r'; }
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
 -c 'CREATE ROLE syndes_core LOGIN PASSWORD '\''ci-internal-only'\''' >/dev/null
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
 -c 'CREATE DATABASE syndes_control' >/dev/null

docker cp infra/postgres/bootstrap/control.schema "$container":/tmp/control.schema
docker cp infra/postgres/bootstrap/control-account-roles.schema "$container":/tmp/control-account-roles.schema
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d syndes_control -f /tmp/control.schema >/dev/null
for pass in 1 2; do
 docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d syndes_control \
  -f /tmp/control-account-roles.schema >/dev/null
done

a='11111111-1111-4111-8111-111111111111'
b='22222222-2222-4222-8222-222222222222'
sql >/dev/null <<'SQL'
INSERT INTO tenant_registry(tenant_id,database_name,role_name,state) VALUES
('11111111-1111-4111-8111-111111111111',
 'syndes_tenant_11111111111141118111111111111111',
 'syndes_t_11111111111141118111111111111111','active'),
('22222222-2222-4222-8222-222222222222',
 'syndes_tenant_22222222222242228222222222222222',
 'syndes_t_22222222222242228222222222222222','active');
INSERT INTO tenant_memberships(tenant_id,principal_id,state) VALUES
('11111111-1111-4111-8111-111111111111','owner-a','active'),
('11111111-1111-4111-8111-111111111111','backup-owner-a','active'),
('11111111-1111-4111-8111-111111111111','admin-a','active'),
('22222222-2222-4222-8222-222222222222','owner-b','active'),
('22222222-2222-4222-8222-222222222222','revoked-member-b','revoked');

INSERT INTO tenant_account_role_grants(
 tenant_id,principal_id,role,granted_by,updated_by)
VALUES('11111111-1111-4111-8111-111111111111','owner-a','owner','dba-approved-ci','dba-approved-ci'),
('22222222-2222-4222-8222-222222222222','owner-b','owner','dba-approved-ci','dba-approved-ci'),
('11111111-1111-4111-8111-111111111111','admin-a','admin','dba-approved-ci','dba-approved-ci');
SQL

[[ "$(scalar "SELECT count(*) FROM tenant_account_role_audit WHERE event='granted'")" == 3 ]] ||
 { echo "Missing first grant audit events" >&2; exit 1; }
# Access is based on matching tenant membership AND account role; neither a
# matching principal across tenants nor an inactive membership can grant access.
[[ "$(scalar "SELECT count(*) FROM tenant_account_role_grants g
 JOIN tenant_memberships m USING(tenant_id,principal_id)
 WHERE g.tenant_id='$a' AND g.principal_id='owner-a'
 AND g.role='owner' AND g.state='active' AND m.state='active'")" == 1 ]] || exit 1
[[ "$(scalar "SELECT count(*) FROM tenant_account_role_grants g
 JOIN tenant_memberships m USING(tenant_id,principal_id)
 WHERE g.tenant_id='$b' AND g.principal_id='owner-a'
 AND g.state='active' AND m.state='active'")" == 0 ]] || exit 1
[[ "$(scalar "SELECT count(*) FROM tenant_account_role_grants WHERE role='owner'
 AND tenant_id='$a'")" == 1 ]] || exit 1

# Prevent cross-tenant orphan and identity forgery.
if sql -c "INSERT INTO tenant_account_role_grants(tenant_id,principal_id,role,granted_by,updated_by)
 VALUES('$b','owner-a','owner','forged','forged')" >/dev/null 2>&1; then
 echo "Untrusted cross-tenant principal was granted" >&2; exit 1
fi
if sql -c "INSERT INTO tenant_account_role_grants(tenant_id,principal_id,role,granted_by,updated_by)
 VALUES('$b','revoked-member-b','admin','forged','forged')" >/dev/null 2>&1; then
 echo "Revoked tenant member was granted role" >&2; exit 1
fi

# A single active account owner may not be removed until a second owner exists.
if sql -c "UPDATE tenant_account_role_grants SET
 state='revoked',revoked_by='dba-approved-ci',revoked_at=clock_timestamp(),
 updated_by='dba-approved-ci',updated_at=clock_timestamp()
 WHERE tenant_id='$a' AND principal_id='owner-a'" >/dev/null 2>&1; then
 echo "Last active account owner was revoked" >&2; exit 1
fi
[[ "$(scalar "SELECT count(*) FROM tenant_account_role_grants WHERE tenant_id='$a'
 AND role='owner' AND state='active'")" == 1 ]] || exit 1

sql >/dev/null <<'SQL'
INSERT INTO tenant_account_role_grants(
 tenant_id,principal_id,role,granted_by,updated_by)
VALUES ('11111111-1111-4111-8111-111111111111','backup-owner-a','owner','dba-approved-ci','dba-approved-ci');
UPDATE tenant_account_role_grants SET
 state='revoked',revoked_by='dba-approved-ci',revoked_at=clock_timestamp(),
 updated_by='dba-approved-ci',updated_at=clock_timestamp()
 WHERE tenant_id='11111111-1111-4111-8111-111111111111' AND principal_id='owner-a';
SQL
[[ "$(scalar "SELECT count(*) FROM tenant_account_role_audit WHERE
 tenant_id='$a' AND principal_id='owner-a' AND event='revoked'")" == 1 ]] || exit 1
[[ "$(scalar "SELECT count(*) FROM tenant_account_role_grants g
 JOIN tenant_memberships m USING(tenant_id,principal_id)
 WHERE g.tenant_id='$a' AND g.principal_id='owner-a'
 AND g.state='active' AND m.state='active'")" == 0 ]] || exit 1

# Tenant membership revocation invalidates effective access *immediately*.
sql -c "UPDATE tenant_memberships SET state='revoked'
 WHERE tenant_id='$b' AND principal_id='owner-b'" >/dev/null
[[ "$(scalar "SELECT count(*) FROM tenant_account_role_grants g
 JOIN tenant_memberships m USING(tenant_id,principal_id)
 WHERE g.tenant_id='$b' AND g.principal_id='owner-b'
 AND g.state='active' AND m.state='active'")" == 0 ]] || exit 1

# Deletion of grants/audits is forbidden; no runtime may directly mutate.
if sql -c "DELETE FROM tenant_account_role_grants WHERE tenant_id='$a'
 AND principal_id='admin-a'" >/dev/null 2>&1; then
 echo "Physical account grant deletion unexpectedly allowed" >&2; exit 1
fi
if sql -c "SET ROLE syndes_core; SELECT count(*) FROM tenant_account_role_grants" >/dev/null 2>&1; then
 echo "Core tenant runtime unexpectedly sees control-plane account roles" >&2; exit 1
fi
if sql -c "SET ROLE syndes_core; UPDATE tenant_account_role_grants SET role='owner'
 WHERE tenant_id='$a' AND principal_id='admin-a'" >/dev/null 2>&1; then
 echo "Core tenant runtime unexpectedly escalated account role" >&2; exit 1
fi
if sql -c "SET ROLE syndes_core; INSERT INTO tenant_account_role_audit
 (tenant_id,principal_id,role,event,actor_id)
 VALUES('$a','admin-a','owner','granted','forged')" >/dev/null 2>&1; then
 echo "Core tenant runtime unexpectedly forged audit" >&2; exit 1
fi

# Reapplying migration must not erase or modify roles/audits.
before=$(scalar "SELECT count(*) FROM tenant_account_role_audit")
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d syndes_control -f /tmp/control-account-roles.schema >/dev/null
after=$(scalar "SELECT count(*) FROM tenant_account_role_audit")
[[ "$before" == "$after" && "$after" == 5 ]] ||
 { echo "Migration idempotence or event history failed ($before/$after)" >&2; exit 1; }
echo "Account grants: real PG17 A/B isolation, scoped owner/admin, revocation, last-owner, audit, no Core DML, idempotence PASS"
