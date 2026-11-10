-- CANDIDATE ONLY (AK-40.01). NOT wired into the legacy Host migration manifest.
-- Generated from sql/006_context_creation_audit.sql; do not edit this output by hand.
-- Requires separately installed CRM/Inbox/WhatsApp schemas and approved AK-30 installer.
-- Stage C6: additive audit vocabulary for controlled multi-context creation.
-- Does NOT remove any index, enable multi-org, or create a second context.
DO $migration$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_constraint
   WHERE conname='platform_org_audit_event_check'
     AND conrelid='organizations.platform_org_audit'::regclass) THEN
  ALTER TABLE organizations.platform_org_audit
    DROP CONSTRAINT platform_org_audit_event_check;
 END IF;
 ALTER TABLE organizations.platform_org_audit
   ADD CONSTRAINT platform_org_audit_event_check
   CHECK(event IN(
      'default_context_initialized','unit_created',
      'organization_created','workspace_created'
   ));
END $migration$;
