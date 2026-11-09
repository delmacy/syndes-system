-- Runs inside the already-resolved tenant database, never the global control DB.
CREATE TABLE IF NOT EXISTS whatsapp_accounts (
 id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL,
 display_name varchar(100) NOT NULL,
 phone_external_id varchar(128),
 device_jid varchar(256),
 connection_status varchar(20) NOT NULL DEFAULT 'unpaired'
   CHECK (connection_status IN ('unpaired','pairing','connected','disconnected','error')),
 service_enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (tenant_id,id),
 UNIQUE (tenant_id,device_jid)
);
CREATE INDEX IF NOT EXISTS whatsapp_accounts_tenant_idx ON whatsapp_accounts(tenant_id,created_at);
-- Durable outbound intents. Claim atomically with SKIP LOCKED; rate control is per account.
CREATE TABLE IF NOT EXISTS whatsapp_outbox (
 id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL,
 account_id uuid NOT NULL,
 idempotency_key varchar(160) NOT NULL,
 recipient_external_id varchar(256) NOT NULL,
 body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
 status varchar(20) NOT NULL DEFAULT 'pending'
   CHECK (status IN ('pending','processing','sent','failed')),
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 claim_until timestamptz,
 external_message_id varchar(256),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (tenant_id,account_id,idempotency_key),
 FOREIGN KEY (tenant_id,account_id) REFERENCES whatsapp_accounts(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS whatsapp_outbox_pending_idx ON whatsapp_outbox(next_attempt_at,created_at)
 WHERE status IN ('pending','processing');
CREATE TABLE IF NOT EXISTS whatsapp_outbound_send_windows (
 account_id uuid NOT NULL REFERENCES whatsapp_accounts(id),
 window_start timestamptz NOT NULL,
 reserved_count integer NOT NULL CHECK(reserved_count BETWEEN 0 AND 40),
 PRIMARY KEY(account_id,window_start)
);
