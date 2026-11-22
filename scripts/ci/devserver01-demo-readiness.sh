#!/usr/bin/env bash
# Read-only acceptance inventory. Output contains status and counts only.
set -Eeuo pipefail
[[ "${SYNDES_DEMO_READINESS:-}" == ACTIONS_READONLY_DEMOS ]] || exit 2
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || exit 2
pg="$(docker ps -q --filter label=com.docker.compose.project=syndes-postgres --filter label=com.docker.compose.service=postgres)"
[[ "$pg" =~ ^[a-f0-9]{12,64}$ ]] || exit 3
query(){
 local db="$1"
 shift
 docker exec -e 'PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=6000' "$pg" \
   psql -w -XAt -v ON_ERROR_STOP=1 -U postgres -d "$db" "$@" 2>/dev/null
}
report_count(){
 local name="$1" db="$2" sql="$3" value
 if value="$(query "$db" -c "$sql")" && [[ "$value" =~ ^[0-9]+$ ]]; then
  printf '%s=%s\n' "$name" "$value"
 else
  printf '%s=unverified\n' "$name"
 fi
}
report_count MANAGER_CONTROL_ACTIVE_OWNERS syndes_control \
 "SELECT count(*) FROM public.platform_operator_access WHERE role='owner' AND state='active'"
report_count MANAGER_SQL_ROLE_PASSWORD_SET syndes_control \
 "SELECT count(*) FROM pg_authid WHERE rolname='syndes_master_api' AND rolcanlogin AND NOT rolsuper AND rolpassword IS NOT NULL"
report_count MANAGER_DEMO_KEYCLOAK_ENABLED syndes_keycloak \
 "SELECT count(*) FROM public.user_entity u JOIN public.realm r ON r.id=u.realm_id WHERE r.name='syndes' AND u.username='syndes-manager' AND u.enabled"

# Match the existing demo user's immutable subject to its Control grant.
# The identifier is transferred only between the read-only server-side queries.
if subject="$(query syndes_keycloak -c "SELECT u.id FROM public.user_entity u JOIN public.realm r ON r.id=u.realm_id WHERE r.name='syndes' AND u.username='syndes-manager' AND u.enabled")" &&
   [[ "$subject" =~ ^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$ ]]; then
 report_count MANAGER_DEMO_ACTIVE_OWNER_GRANT syndes_control \
  "SELECT count(*) FROM public.platform_operator_access WHERE principal_id='$subject' AND role='owner' AND state='active'"
else
 echo MANAGER_DEMO_ACTIVE_OWNER_GRANT=unverified
fi
unset subject
if sudo -n test -s /run/syndes/platform-manager/master_db_url 2>/dev/null; then
 echo MANAGER_RENDERED_DB_SECRET=present
elif sudo -n true 2>/dev/null; then
 echo MANAGER_RENDERED_DB_SECRET=absent
else
 echo MANAGER_RENDERED_DB_SECRET=unverified
fi
api="$(docker ps -q --filter label=com.docker.compose.project=syndes-master-admin --filter label=com.docker.compose.service=master-api)"
if [[ "$api" =~ ^[a-f0-9]{12,64}$ ]] &&
 docker exec "$api" node -e "fetch('http://127.0.0.1:8085/readyz',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
 echo MANAGER_API=ready
else
 echo MANAGER_API=not_ready
fi
tenant=1f5a8ce9-3f01-48cc-a013-2198d99e7510
if current="$(query syndes_control -c "SELECT state FROM public.tenant_registry WHERE tenant_id='$tenant'")" &&
 [[ "$current" =~ ^(provisioned|active|suspended)$ ]]; then
 printf 'OPERATIONAL_MULTIORG_STATE=%s\n' "$current"
else
 echo OPERATIONAL_MULTIORG_STATE=unverified
fi
report_count OPERATIONAL_MULTIORG_ACTIVE_IDENTITY_LINKS syndes_control \
 "SELECT count(*) FROM public.platform_keycloak_org_links WHERE tenant_id='$tenant' AND state='active'"
report_count OPERATIONAL_MULTIORG_ACTIVE_MEMBERSHIPS syndes_control \
 "SELECT count(*) FROM public.tenant_memberships WHERE tenant_id='$tenant' AND state='active'"
echo DEVSERVER01_DEMO_READINESS_OBSERVED_READ_ONLY
