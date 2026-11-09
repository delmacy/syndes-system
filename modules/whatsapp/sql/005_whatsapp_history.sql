-- Only tenant-local presentation and synchronization metadata. No provider credentials.
ALTER TABLE inbox_conversations ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false;
ALTER TABLE inbox_conversations ADD COLUMN IF NOT EXISTS unread_count integer NOT NULL DEFAULT 0 CHECK(unread_count>=0);
ALTER TABLE inbox_conversations ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;
ALTER TABLE inbox_conversations ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
ALTER TABLE inbox_conversations ADD COLUMN IF NOT EXISTS history_sync_at timestamptz;
CREATE INDEX IF NOT EXISTS inbox_wa_display_scope_idx
 ON inbox_conversations(tenant_id,is_archived,is_group,updated_at DESC)
 WHERE channel='whatsapp';
CREATE INDEX IF NOT EXISTS inbox_wa_unread_idx
 ON inbox_conversations(tenant_id,updated_at DESC) WHERE unread_count>0;
CREATE INDEX IF NOT EXISTS inbox_wa_favorite_idx
 ON inbox_conversations(tenant_id,updated_at DESC) WHERE is_favorite=true;
ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS source varchar(12) NOT NULL DEFAULT 'local'
 CHECK(source IN ('local','live','history'));
ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS bot_eligible boolean NOT NULL DEFAULT false;
ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS provider_message_id varchar(256);
ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS provider_sender_id varchar(256);
CREATE INDEX IF NOT EXISTS inbox_wa_history_anchor_idx
 ON inbox_messages(tenant_id,conversation_id,created_at ASC)
 WHERE source IN ('live','history') AND provider_message_id IS NOT NULL;
