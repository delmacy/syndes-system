#!/usr/bin/env bash
set -Eeuo pipefail
docker run -d --name syndes-inbox-ci-pg -p 127.0.0.1:54339:5432 -e POSTGRES_PASSWORD=ci-inbox-only postgres:17-bookworm >/dev/null
trap 'docker rm -f syndes-inbox-ci-pg >/dev/null 2>&1 || true' EXIT
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
node --test apps/core-host/test/inbox-pg-http.integration.mjs
echo "Inbox PostgreSQL + installed Core Host HTTP contract: PASS"
