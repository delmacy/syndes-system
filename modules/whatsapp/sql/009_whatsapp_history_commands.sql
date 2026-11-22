-- Tenant-local commands. No grant or trigger enables the pilot.
CREATE TABLE IF NOT EXISTS whatsapp_history_commands (
 id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL,
 organization_id uuid NOT NULL,
 workspace_id uuid NOT NULL,
 conversation_id uuid NOT NULL,
 account_id uuid NOT NULL,
 principal_id text NOT NULL,
 epoch bigint NOT NULL CHECK (epoch > 0),
 anchor_message_id text NOT NULL,
 state text NOT NULL DEFAULT 'pending'
  CHECK (state IN ('pending','cancelled','attempted','accepted','uncertain')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS whatsapp_history_commands_pending
 ON whatsapp_history_commands (tenant_id, created_at, id) WHERE state='pending';

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_history_commands_anchor
 ON whatsapp_history_commands (tenant_id, conversation_id, account_id, anchor_message_id)
 WHERE state <> 'cancelled';
