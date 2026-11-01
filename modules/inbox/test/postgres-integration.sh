#!/usr/bin/env bash
set -Eeuo pipefail
docker run -d --name syndes-inbox-ci-pg -p 127.0.0.1:54329:5432 -e POSTGRES_PASSWORD=ci-admin-not-production-123 postgres:17-bookworm >/dev/null
trap 'docker rm -f syndes-inbox-ci-pg >/dev/null 2>&1 || true' EXIT
for attempt in $(seq 1 40);do
 if docker exec syndes-inbox-ci-pg pg_isready -U postgres -d postgres >/dev/null 2>&1;then break;fi
 if [[ "$attempt" == 40 ]];then echo "Inbox SQL database not ready" >&2;exit 1;fi
 sleep 2
done
for id in 4ab44379-d557-4df6-a2be-d44e121a8077 d21930aa-f4f6-40c0-bb1a-e71d7bb92caa;do
 suffix="${id//-/}"
 role="syndes_t_$suffix";db="syndes_tenant_$suffix"
 docker exec syndes-inbox-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c \
  "CREATE ROLE $role LOGIN PASSWORD 'ci-inbox-tenant-pass-123456789'" >/dev/null
 docker exec syndes-inbox-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c \
  "CREATE DATABASE $db OWNER $role" >/dev/null
 docker exec syndes-inbox-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c \
  "REVOKE CONNECT ON DATABASE $db FROM PUBLIC" >/dev/null
 docker exec syndes-inbox-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c \
  "GRANT CONNECT ON DATABASE $db TO $role" >/dev/null
 for path in modules/core-crm/sql/001_crm_foundation.sql modules/inbox/sql/001_inbox_foundation.sql;do
  { printf 'SET ROLE %s;\n' "$role";cat "$path"; } | \
   docker exec -i syndes-inbox-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d "$db" >/dev/null
 done
 # Migrations must be repeatable without destroying existing conversations.
 { printf 'SET ROLE %s;\n' "$role";cat modules/inbox/sql/001_inbox_foundation.sql; } | \
  docker exec -i syndes-inbox-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d "$db" >/dev/null
done
node modules/inbox/test/postgres-acceptance.mjs
