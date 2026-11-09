-- Stage C6: additive audit vocabulary for controlled multi-context creation.
-- Does NOT remove any index, enable multi-org, or create a second context.
DO $migration$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_constraint
   WHERE conname='platform_org_audit_event_check'
     AND conrelid='platform_org_audit'::regclass) THEN
  ALTER TABLE platform_org_audit
    DROP CONSTRAINT platform_org_audit_event_check;
 END IF;
 ALTER TABLE platform_org_audit
   ADD CONSTRAINT platform_org_audit_event_check
   CHECK(event IN(
      'default_context_initialized','unit_created',
      'organization_created','workspace_created'
   ));
END $migration$;
