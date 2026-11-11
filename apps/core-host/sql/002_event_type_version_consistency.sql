-- Additive contract integrity for the tenant-local outbox. Do not run on syndes_control.
-- Existing mismatched records cause validation to FAIL CLOSED for review/reconciliation.
DO $migration$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conname='platform_outbox_type_version_matches'
    AND conrelid='platform_events.outbox_events'::regclass
 ) THEN
  ALTER TABLE platform_events.outbox_events
   ADD CONSTRAINT platform_outbox_type_version_matches
   CHECK (event_version = substring(event_type FROM '\.v([1-9][0-9]*)$')::integer)
   NOT VALID;
 END IF;
END
$migration$;

-- Validating again is safe on an already-validated constraint.
ALTER TABLE platform_events.outbox_events
 VALIDATE CONSTRAINT platform_outbox_type_version_matches;
