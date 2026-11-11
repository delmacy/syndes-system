-- SM-05A, optional tenant-local read-only Inbox Inspector projection index.
-- Apply only with approved Service 001/002, Organizations 007, staging restore
-- and entitlement installation gates; never against syndes_control.
BEGIN;
DO $preflight$
BEGIN
 IF to_regclass('service_attendances') IS NULL OR
    to_regclass('inbox_conversations') IS NULL OR
    to_regclass('platform_staff_team_members') IS NULL OR
    to_regprocedure('service_team_can_read(uuid,uuid,uuid,uuid,text)') IS NULL OR
    NOT EXISTS(SELECT 1 FROM information_schema.columns
     WHERE table_schema=current_schema() AND table_name='service_attendances'
       AND column_name='team_id') THEN
  RAISE EXCEPTION 'Inspector requires Service 002, Inbox ownership and Workforce 007'
   USING ERRCODE='55000';
 END IF;
END $preflight$;
CREATE INDEX IF NOT EXISTS service_attendance_inspector_conversation_idx
 ON service_attendances(
  tenant_id,organization_id,workspace_id,inbox_conversation_id,
  created_at DESC,id DESC)
 WHERE inbox_conversation_id IS NOT NULL;
COMMIT;
