-- Provider-confirmed receipts only, scoped to tenant and linked WhatsApp account.
-- Separate from outgoing transport states: "sent" is not "delivered".
CREATE TABLE IF NOT EXISTS whatsapp_delivery_receipts (
 tenant_id uuid NOT NULL,
 account_id uuid NOT NULL,
 provider_message_id varchar(256) NOT NULL CHECK(char_length(provider_message_id)>0),
 chat_external_id varchar(256) NOT NULL CHECK(char_length(chat_external_id)>3),
 status varchar(12) NOT NULL CHECK(status IN ('delivered','read')),
 confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,account_id,provider_message_id),
 FOREIGN KEY(tenant_id,account_id) REFERENCES whatsapp_accounts(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS whatsapp_delivery_receipts_lookup_idx
 ON whatsapp_delivery_receipts(tenant_id,account_id,provider_message_id);
