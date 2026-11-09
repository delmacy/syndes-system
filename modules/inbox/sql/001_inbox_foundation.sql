-- Installed only in a canonical tenant database, after CRM migrations.
BEGIN;
CREATE TABLE IF NOT EXISTS inbox_conversations (
  tenant_id UUID NOT NULL,
  id UUID NOT NULL,
  crm_person_id UUID,
  subject VARCHAR(160) NOT NULL CHECK (length(trim(subject))>0),
  channel VARCHAR(32) NOT NULL DEFAULT 'simulation',
  external_thread_id VARCHAR(160),
  status VARCHAR(16) NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','resolved')),
  assigned_to VARCHAR(128),
  handoff VARCHAR(8) NOT NULL DEFAULT 'human' CHECK (handoff IN ('human','bot')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,crm_person_id) REFERENCES crm_people(tenant_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS inbox_unique_external_thread
  ON inbox_conversations(tenant_id,channel,external_thread_id)
  WHERE external_thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inbox_queue_idx
  ON inbox_conversations(tenant_id,status,updated_at DESC);
CREATE TABLE IF NOT EXISTS inbox_messages (
  tenant_id UUID NOT NULL,
  id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  direction VARCHAR(16) NOT NULL CHECK (direction IN ('inbound','outbound','internal')),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  author_id TEXT NOT NULL,
  external_message_id VARCHAR(160),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,conversation_id) REFERENCES inbox_conversations(tenant_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS inbox_message_dedup
  ON inbox_messages(tenant_id,conversation_id,external_message_id)
  WHERE external_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inbox_history_idx
  ON inbox_messages(tenant_id,conversation_id,created_at,id);
CREATE TABLE IF NOT EXISTS inbox_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  actor_id TEXT NOT NULL,
  action VARCHAR(48) NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (tenant_id,conversation_id) REFERENCES inbox_conversations(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS inbox_audit_idx ON inbox_events(tenant_id,conversation_id,id);
COMMIT;
