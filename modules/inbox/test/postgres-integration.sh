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
 docker exec -i syndes-inbox-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$migration" >/dev/null
done
node modules/inbox/test/pg-integration.mjs
node --test apps/core-host/test/inbox-pg-http.integration.mjs
echo "Inbox PostgreSQL + installed Core Host HTTP contract: PASS"
