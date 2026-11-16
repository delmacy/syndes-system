#!/usr/bin/env bash
set -Eeuo pipefail
# All fixtures stay inside Actions and bind localhost; never use an operator's server.
for name in syndes-inbox-ci-pg syndes-inbox-preflight-fga; do
 if docker container inspect "$name" >/dev/null 2>&1; then
  echo "Refusing to reuse an existing fixture: $name" >&2;exit 3
 fi
done
cleanup_inbox_fixtures() {
 for descriptor in "syndes-inbox-preflight-fga:inbox-assignment-preflight:openfga/openfga:v1.22.1" "syndes-inbox-ci-pg:inbox-pg17-ci:postgres:17-bookworm";do
  name="${descriptor%%:*}"
  remainder="${descriptor#*:}"
  label="${remainder%%:*}"
  image="${remainder#*:}"
  if docker container inspect "$name" >/dev/null 2>&1; then
   if [[ "$(docker inspect -f '{{index .Config.Labels "syndes.disposable"}}' "$name")" == "$label" && "$(docker inspect -f '{{.Config.Image}}' "$name")" == "$image" ]];then
    docker rm -f "$name" >/dev/null 2>&1 || true
   else
    echo "Refusing to stop an unrecognized container: $name" >&2
   fi
  fi
 done
}
trap cleanup_inbox_fixtures EXIT
docker run -d --name syndes-inbox-ci-pg --label syndes.disposable=inbox-pg17-ci -p 127.0.0.1:54339:5432 -e POSTGRES_PASSWORD=ci-inbox-only postgres:17-bookworm >/dev/null
for attempt in $(seq 1 40);do
 if docker exec syndes-inbox-ci-pg pg_isready -U postgres -d postgres >/dev/null 2>&1;then break;fi
 if [[ "$attempt" == 40 ]];then echo "Inbox DB not ready" >&2;exit 1;fi
 sleep 2
done
# Inbox listing and contact names depend on the WhatsApp conversation routing
# tables. Recreate the full additive tenant schema in the isolated CI database.
for migration in modules/core-crm/sql/001_crm_foundation.sql modules/inbox/sql/001_inbox_foundation.sql \
 modules/whatsapp/sql/001_whatsapp_accounts.sql modules/whatsapp/sql/002_whatsapp_inbound.sql \
 modules/whatsapp/sql/003_whatsapp_outbound_inbox.sql modules/whatsapp/sql/004_whatsapp_conversation_phone.sql \
 modules/whatsapp/sql/005_whatsapp_history.sql modules/whatsapp/sql/006_whatsapp_contact_names.sql \
 modules/whatsapp/sql/007_whatsapp_delivery_receipts.sql;do
 docker exec -i syndes-inbox-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$migration" >/dev/null
done
# The Inbox HTTP Host now enforces the platform ownership/backfill gate.
# The disposable CI database needs full CRM and organization foundation schema.
for migration in modules/core-crm/sql/002_crm_tags_notes.sql modules/core-crm/sql/003_crm_employees_channels.sql \
 modules/organizations/sql/001_account_hierarchy.sql modules/organizations/sql/002_legacy_single_context_gate.sql \
 modules/organizations/sql/003_legacy_ownership.sql;do
 docker exec -i syndes-inbox-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$migration" >/dev/null
done

# Regression for the production history outage: operator-applied migration 007
# must grant the exact tenant runtime role read/write privileges. Do this in a
# disposable database with a real tenant-style name and another isolated role.
TENANT_DB=syndes_tenant_00000000000040008000000000000001
TENANT_ROLE=syndes_t_00000000000040008000000000000001
FOREIGN_ROLE=syndes_t_00000000000040008000000000000002
docker exec syndes-inbox-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "CREATE ROLE $TENANT_ROLE; CREATE ROLE $FOREIGN_ROLE;" >/dev/null
docker exec syndes-inbox-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "CREATE DATABASE $TENANT_DB;" >/dev/null
for migration in modules/core-crm/sql/001_crm_foundation.sql modules/inbox/sql/001_inbox_foundation.sql \
 modules/whatsapp/sql/001_whatsapp_accounts.sql modules/whatsapp/sql/002_whatsapp_inbound.sql \
 modules/whatsapp/sql/003_whatsapp_outbound_inbox.sql modules/whatsapp/sql/004_whatsapp_conversation_phone.sql \
 modules/whatsapp/sql/005_whatsapp_history.sql modules/whatsapp/sql/006_whatsapp_contact_names.sql;do
 docker exec -i syndes-inbox-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d "$TENANT_DB" < "$migration" >/dev/null
done
# Existing Inbox tables were accessible before the new migration.
docker exec syndes-inbox-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d "$TENANT_DB" -c "GRANT USAGE ON SCHEMA public TO $TENANT_ROLE; GRANT SELECT ON ALL TABLES IN SCHEMA public TO $TENANT_ROLE;" >/dev/null
# Preserve a real historical row across the migration; this reproduces the
# exact symptom from the DevServer01 regression rather than testing empty tables.
docker exec syndes-inbox-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d "$TENANT_DB" -c "
 INSERT INTO inbox_conversations(tenant_id,id,subject,channel)
 VALUES ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000010','Preserved chat','whatsapp');
 INSERT INTO inbox_messages(tenant_id,id,conversation_id,direction,body,author_id)
 VALUES ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000020',
         '00000000-0000-4000-8000-000000000010','inbound','Historical message preserved','test');
" >/dev/null
docker exec -i syndes-inbox-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d "$TENANT_DB" < modules/whatsapp/sql/007_whatsapp_delivery_receipts.sql >/dev/null
# Operator redeploy must remain idempotent.
docker exec -i syndes-inbox-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d "$TENANT_DB" < modules/whatsapp/sql/007_whatsapp_delivery_receipts.sql >/dev/null
docker exec syndes-inbox-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d "$TENANT_DB" -Atc "SET ROLE $TENANT_ROLE; SELECT count(*) FROM inbox_messages; SELECT count(*) FROM whatsapp_delivery_receipts; SELECT has_table_privilege(current_user,'whatsapp_delivery_receipts','INSERT,UPDATE');" | tail -1 | grep -qx t
docker exec syndes-inbox-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d "$TENANT_DB" -Atc "SET ROLE $TENANT_ROLE; SELECT body FROM inbox_messages WHERE id='00000000-0000-4000-8000-000000000020';" | grep -qx 'Historical message preserved'
# Foreign tenant has no SELECT privilege, including after grants above.
docker exec syndes-inbox-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d "$TENANT_DB" -Atc "SELECT has_table_privilege('$FOREIGN_ROLE','whatsapp_delivery_receipts','SELECT');" | grep -qx f
echo "Tenant migration 007 runtime permissions and cross-tenant deny: PASS"
SYNDES_INBOX_SCOPE_TEST_PG_URL=postgres://postgres:ci-inbox-only@127.0.0.1:54339/postgres \
 node --test modules/inbox/test/pg-org-scope.mjs
# Whatsmeow-to-Inbox ownership A/B and outbound queue safety on disposable PG
SYNDES_INBOX_SCOPE_TEST_PG_URL=postgres://postgres:ci-inbox-only@127.0.0.1:54339/postgres \
 node --test modules/whatsapp/test/pg-org-scope.mjs
node modules/inbox/test/pg-integration.mjs
SYNDES_INBOX_SCOPE_TEST_PG_URL=postgres://postgres:ci-inbox-only@127.0.0.1:54339/postgres \
 node --test modules/inbox/test/pg-assignment-races.mjs
node --test apps/core-host/test/inbox-pg-http.integration.mjs
# Pre-deployment rehearsal: analyze historical assignments in a disposable
# transaction only. The diagnostic SQL never repairs or discloses real users.
SYNDES_INBOX_SCOPE_TEST_PG_URL=postgres://postgres:ci-inbox-only@127.0.0.1:54339/postgres \
 node --test modules/inbox/test/pg-assignment-preflight.mjs

# Real OpenFGA model and revocation exercise on a throwaway, memory-only store.
# The fixture has no production tokens, persistent volume or public listener.
docker run --rm -d --name syndes-inbox-preflight-fga \
 --label syndes.disposable=inbox-assignment-preflight \
 --memory 512m --pids-limit 128 -p 127.0.0.1:18091:8080 \
 openfga/openfga:v1.22.1 run --datastore-engine memory \
 --authn-method none --playground-enabled=false --metrics-enabled=false >/dev/null
ready=false
for attempt in $(seq 1 35); do
 if curl -fsS --max-time 2 http://127.0.0.1:18091/healthz >/dev/null 2>&1; then ready=true;break;fi
 sleep 1
done
if [[ "$ready" != true ]];then echo "Disposable Inbox OpenFGA unavailable" >&2;exit 5;fi
SYNDES_INBOX_FGA_PREFLIGHT=DISPOSABLE_ONLY \
 SYNDES_INBOX_FGA_URL=http://127.0.0.1:18091 \
 node --test modules/inbox/test/fga-assignment-preflight.mjs
echo "P02-ASSIGN pre-deployment PG/FGA test only: PASS; NO production IAM, rollout or data migration"
