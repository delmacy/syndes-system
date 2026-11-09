-- Tenant-scoped audit of explicit WhatsApp contact-name changes.
-- A successful send only establishes WhatsApp server ACK, not phone sync.
CREATE TABLE IF NOT EXISTS whatsapp_contact_name_changes(
 id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL,
 conversation_id uuid NOT NULL,
 account_id uuid NOT NULL,
 phone_e164 varchar(16) NOT NULL CHECK (phone_e164 ~ '^\+[1-9][0-9]{9,14}$'),
 requested_name varchar(160) NOT NULL CHECK (char_length(btrim(requested_name))>0),
 actor_id text NOT NULL,
 save_on_primary boolean NOT NULL DEFAULT false,
 status varchar(12) NOT NULL CHECK(status IN ('pending','submitted','failed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,conversation_id) REFERENCES inbox_conversations(tenant_id,id),
 FOREIGN KEY(tenant_id,account_id) REFERENCES whatsapp_accounts(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS whatsapp_name_changes_tenant_idx
 ON whatsapp_contact_name_changes(tenant_id,conversation_id,created_at DESC);
CREATE TABLE IF NOT EXISTS whatsapp_contact_name_labels(
 tenant_id uuid NOT NULL,
 account_id uuid NOT NULL,
 phone_e164 varchar(16) NOT NULL CHECK(phone_e164 ~ '^\+[1-9][0-9]{9,14}$'),
 full_name varchar(160) NOT NULL,
 last_change_id uuid NOT NULL REFERENCES whatsapp_contact_name_changes(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,account_id,phone_e164),
 FOREIGN KEY(tenant_id,account_id) REFERENCES whatsapp_accounts(tenant_id,id)
);
