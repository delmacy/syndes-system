-- Additive, tenant-local ownership marker for inbound message projection.
-- Legacy is the immutable default. Never enable event bridge before this
-- migration and a Host-only, single-projector cutover gate are approved.
-- Do NOT modify SQL 002 single-Organization/Workspace safety barrier.
ALTER TABLE whatsapp_inbound_events
 ADD COLUMN IF NOT EXISTS projection_path text NOT NULL DEFAULT 'legacy';

DO $check$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM pg_constraint
  WHERE conrelid='whatsapp_inbound_events'::regclass
    AND conname='whatsapp_inbound_projection_path_check'
 ) THEN
  ALTER TABLE whatsapp_inbound_events
    ADD CONSTRAINT whatsapp_inbound_projection_path_check CHECK (
      projection_path IS NOT NULL
      AND projection_path IN ('legacy','events')
      AND (projection_path='legacy' OR event_type='whatsapp.message.received')
    ) NOT VALID;
 END IF;
END
$check$;
ALTER TABLE whatsapp_inbound_events
 VALIDATE CONSTRAINT whatsapp_inbound_projection_path_check;

CREATE OR REPLACE FUNCTION whatsapp_reject_projection_path_change()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $immut$
BEGIN
 IF NEW.projection_path IS DISTINCT FROM OLD.projection_path THEN
  RAISE EXCEPTION 'WhatsApp inbound projection path is immutable'
   USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END
$immut$;

DO $trigger$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM pg_trigger
  WHERE tgrelid='whatsapp_inbound_events'::regclass
   AND tgname='whatsapp_inbound_projection_path_immutable'
   AND NOT tgisinternal
 ) THEN
  CREATE TRIGGER whatsapp_inbound_projection_path_immutable
  BEFORE UPDATE ON whatsapp_inbound_events
  FOR EACH ROW EXECUTE FUNCTION whatsapp_reject_projection_path_change();
 END IF;
END
$trigger$;

CREATE INDEX IF NOT EXISTS whatsapp_legacy_inbound_queue_idx
 ON whatsapp_inbound_events(tenant_id,id)
 WHERE processed_at IS NULL AND failed_at IS NULL
  AND projection_path='legacy';

COMMENT ON COLUMN whatsapp_inbound_events.projection_path IS
 'Immutable single owner: legacy = existing projector, events = typed outbox dispatcher';
