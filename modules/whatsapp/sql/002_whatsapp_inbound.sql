CREATE TABLE IF NOT EXISTS whatsapp_inbound_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id uuid NOT NULL,
 account_id uuid NOT NULL,
 external_message_id varchar(256) NOT NULL,
 event_type varchar(80) NOT NULL,
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz,
 failed_at timestamptz,
 last_error text,
 UNIQUE(tenant_id,account_id,external_message_id),
 FOREIGN KEY(tenant_id,account_id) REFERENCES whatsapp_accounts(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS whatsapp_inbound_unprocessed_idx ON whatsapp_inbound_events(created_at,id) WHERE processed_at IS NULL;

ALTER TABLE whatsapp_inbound_events ADD COLUMN IF NOT EXISTS failed_at timestamptz;
ALTER TABLE whatsapp_inbound_events ADD COLUMN IF NOT EXISTS last_error text;
