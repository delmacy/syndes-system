-- Runs only inside the trusted tenant database. The route belongs to the
-- tenant, its Inbox conversation, and one of its enabled WhatsApp accounts.
CREATE TABLE IF NOT EXISTS whatsapp_conversation_routes (
 tenant_id uuid NOT NULL,
 conversation_id uuid NOT NULL,
 account_id uuid NOT NULL,
 recipient_external_id varchar(256) NOT NULL
   CHECK (char_length(recipient_external_id) BETWEEN 1 AND 256),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,conversation_id),
 FOREIGN KEY(tenant_id,conversation_id) REFERENCES inbox_conversations(tenant_id,id),
 FOREIGN KEY(tenant_id,account_id) REFERENCES whatsapp_accounts(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS whatsapp_conversation_routes_account_idx
 ON whatsapp_conversation_routes(tenant_id,account_id);
ALTER TABLE whatsapp_outbox ADD COLUMN IF NOT EXISTS gateway_queue_id bigint;
ALTER TABLE whatsapp_outbox ADD COLUMN IF NOT EXISTS inbox_message_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_outbox_message_idx
 ON whatsapp_outbox(tenant_id,inbox_message_id) WHERE inbox_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS whatsapp_outbox_worker_idx
 ON whatsapp_outbox(tenant_id,next_attempt_at,created_at)
 WHERE status IN ('pending','processing');
