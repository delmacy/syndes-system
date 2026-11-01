-- Apply per tenant database AFTER CRM migration 001. Outbound delivery is
-- a durable outbox; the future WhatsApp adapter consumes it asynchronously.
BEGIN;
CREATE TABLE IF NOT EXISTS inbox_conversations(
 tenant_id uuid NOT NULL,
 id uuid NOT NULL,
 source text NOT NULL CHECK(source IN ('whatsapp','email','internal')),
 external_ref text NOT NULL CHECK(length(external_ref) BETWEEN 1 AND 256),
 person_id uuid,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','pending','resolved')),
 assigned_to text,
 human_handoff boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id),
 UNIQUE(tenant_id,source,external_ref),
 FOREIGN KEY(tenant_id,person_id) REFERENCES crm_people(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS inbox_conv_latest ON inbox_conversations(tenant_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS inbox_messages(
 tenant_id uuid NOT NULL,
 id uuid NOT NULL,
 conversation_id uuid NOT NULL,
 source text NOT NULL,
 external_message_id text,
 direction text NOT NULL CHECK(direction IN ('inbound','outbound')),
 author_id text,
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 4096),
 delivery text NOT NULL CHECK(delivery IN ('received','queued','sent','failed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,conversation_id) REFERENCES inbox_conversations(tenant_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS inbox_inbound_dedupe ON inbox_messages(tenant_id,source,external_message_id)
 WHERE direction='inbound' AND external_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inbox_message_order ON inbox_messages(tenant_id,conversation_id,created_at,id);
CREATE TABLE IF NOT EXISTS inbox_outbox(
 tenant_id uuid NOT NULL,
 message_id uuid NOT NULL,
 conversation_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','delivered','failed')),
 attempts int NOT NULL DEFAULT 0,
 available_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,message_id),
 FOREIGN KEY(tenant_id,message_id) REFERENCES inbox_messages(tenant_id,id),
 FOREIGN KEY(tenant_id,conversation_id) REFERENCES inbox_conversations(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS inbox_outbox_due ON inbox_outbox(tenant_id,available_at)
 WHERE status IN ('pending','failed');
CREATE TABLE IF NOT EXISTS inbox_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id uuid NOT NULL,
 conversation_id uuid NOT NULL,
 event text NOT NULL,
 actor_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,conversation_id) REFERENCES inbox_conversations(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS inbox_events_stream ON inbox_events(tenant_id,id);
CREATE TABLE IF NOT EXISTS inbox_attachments(
 tenant_id uuid NOT NULL,
 id uuid NOT NULL,
 message_id uuid NOT NULL,
 storage_key text NOT NULL,
 mime_type text NOT NULL,
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 20971520),
 sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,message_id) REFERENCES inbox_messages(tenant_id,id)
);
COMMIT;
