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
# DC-2b: dedicated operator function is the ONLY mutation surface for the
# account-access runtime. Exercise using a different role, not PostgreSQL superuser.
docker cp infra/postgres/bootstrap/control-account-delegation.schema \
 "$container":/tmp/control-account-delegation.schema
for pass in 1 2; do
 docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d syndes_control \
  -f /tmp/control-account-delegation.schema >/dev/null
done
sql >/dev/null <<'SQL'
INSERT INTO tenant_memberships(tenant_id,principal_id,state) VALUES
('11111111-1111-4111-8111-111111111111','delegate-a','active'),
('22222222-2222-4222-8222-222222222222','delegate-b','active');
SQL
# Must not let Core Host call the function or read the sensitive tables.
if sql -c "SET ROLE syndes_core;
 SELECT * FROM apply_tenant_account_delegation(
 '$a','backup-owner-a','delegate-a','grant','admin',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')" >/dev/null 2>&1; then
 echo "Core Host can call the role delegation function" >&2; exit 1
fi
for table in tenant_account_role_grants tenant_account_role_audit tenant_account_delegation_requests; do
 if sql -c "SET ROLE syndes_account_delegate; SELECT 1 FROM $table LIMIT 1" >/dev/null 2>&1; then
  echo "Dedicated runtime can read $table directly" >&2; exit 1
 fi
done
if sql -c "SET ROLE syndes_account_delegate; INSERT INTO tenant_account_role_grants(
 tenant_id,principal_id,role,granted_by,updated_by)
 VALUES('$a','delegate-a','owner','forged','forged')" >/dev/null 2>&1; then
 echo "Dedicated runtime can write grants directly" >&2; exit 1
fi
first=$(sql -tAc "SET ROLE syndes_account_delegate;
 SELECT role || ':' || state || ':' || already_applied
 FROM apply_tenant_account_delegation(
 '$a','backup-owner-a','delegate-a','grant','admin',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')" | tail -1)
[[ "$first" == 'admin:active:false' ]] || {
 echo "First authorized delegation failed: $first" >&2; exit 1; }
second=$(sql -tAc "SET ROLE syndes_account_delegate;
 SELECT role || ':' || state || ':' || already_applied
 FROM apply_tenant_account_delegation(
 '$a','backup-owner-a','delegate-a','grant','admin',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')" | tail -1)
[[ "$second" == 'admin:active:true' ]] || {
 echo "Idempotent retry failed: $second" >&2; exit 1; }
[[ "$(scalar "SELECT count(*) FROM tenant_account_role_audit WHERE tenant_id='$a'
 AND principal_id='delegate-a' AND event='granted'")" == 1 ]] || exit 1
# Replay of a key with a different request cannot mutate a second account.
if sql -c "SET ROLE syndes_account_delegate;
 SELECT * FROM apply_tenant_account_delegation(
 '$a','backup-owner-a','admin-a','grant','owner',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')" >/dev/null 2>&1; then
 echo "Idempotency key reused for a different target" >&2; exit 1
fi
# Tenant A owner may not appoint on tenant B, even if target B is a real member.
if sql -c "SET ROLE syndes_account_delegate;
 SELECT * FROM apply_tenant_account_delegation(
 '$b','backup-owner-a','delegate-b','grant','admin',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')" >/dev/null 2>&1; then
 echo "Cross-tenant delegation accepted" >&2; exit 1
fi
# Existing account admin is never allowed to appoint another administrator.
if sql -c "SET ROLE syndes_account_delegate;
 SELECT * FROM apply_tenant_account_delegation(
 '$a','admin-a','delegate-a','grant','owner',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd')" >/dev/null 2>&1; then
 echo "Non-owner delegation accepted" >&2; exit 1
fi
# Self-grants are forbidden; the owner cannot use an endpoint to silently
# transfer own account grant.
if sql -c "SET ROLE syndes_account_delegate;
 SELECT * FROM apply_tenant_account_delegation(
 '$a','backup-owner-a','backup-owner-a','revoke','owner',
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')" >/dev/null 2>&1; then
 echo "Self owner revocation accepted" >&2; exit 1
fi
# Revoke target grant, audit it; old idempotency key does not revive it.
sql >/dev/null <<SQL
SET ROLE syndes_account_delegate;
SELECT * FROM apply_tenant_account_delegation(
 '$a','backup-owner-a','delegate-a','revoke','admin',
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
SQL
[[ "$(scalar "SELECT state FROM tenant_account_role_grants
 WHERE tenant_id='$a' AND principal_id='delegate-a'")" == revoked ]] || exit 1
[[ "$(scalar "SELECT count(*) FROM tenant_account_role_audit WHERE tenant_id='$a'
 AND principal_id='delegate-a' AND event='revoked'")" == 1 ]] || exit 1
# Audit historical event cannot be erased by accidental DBA UPDATE/DELETE.
if sql -c "DELETE FROM tenant_account_role_audit WHERE tenant_id='$a'
 AND principal_id='delegate-a'" >/dev/null 2>&1; then
 echo "Delegation audit unexpectedly deletable" >&2; exit 1
fi
for pass in 1 2; do
 docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d syndes_control \
  -f /tmp/control-account-delegation.schema >/dev/null
done
[[ "$(scalar "SELECT count(*) FROM tenant_account_delegation_requests
 WHERE tenant_id='$a'")" == 2 ]] || exit 1
# Direct legacy membership revocation must not orphan the account owner.
if sql -c "UPDATE tenant_memberships SET state='revoked'
 WHERE tenant_id='$a' AND principal_id='backup-owner-a'" >/dev/null 2>&1; then
 echo "Last effective account owner's membership was revoked" >&2; exit 1
fi
if sql -c "DELETE FROM tenant_memberships WHERE tenant_id='$a'
 AND principal_id='backup-owner-a'" >/dev/null 2>&1; then
 echo "Last effective account owner's membership was deleted" >&2; exit 1
fi
if sql -c "UPDATE tenant_account_delegation_requests SET
 actor_id='forged' WHERE tenant_id='$a'" >/dev/null 2>&1; then
 echo "Idempotency history unexpectedly mutable" >&2; exit 1
fi
[[ "$(scalar "SELECT state FROM tenant_memberships WHERE tenant_id='$a'
 AND principal_id='backup-owner-a'")" == active ]] || exit 1
echo "Account delegation: real PG17 restricted EXECUTE, idempotency, owner proof, denial of cross-tenant/admin/self, audit and revoke PASS"
echo "Account grants: real PG17 A/B isolation, scoped owner/admin, revocation, last-owner, audit, no Core DML, idempotence PASS"
