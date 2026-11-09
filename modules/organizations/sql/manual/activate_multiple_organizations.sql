-- Manual multi-org release cutover, NEVER registered as plugin migration.
-- Run with psql --single-transaction -v ON_ERROR_STOP=1 on ONE tenant DB.
-- Requires physical migration rights AND externally recorded Product Gate,
-- verified restorable backup, rollback rehearsal and scoped Host deployment.
-- Custom session settings are change-control attestations, NOT an ACL.
DO $guard$
DECLARE required_name text;
BEGIN
 IF current_setting('syndes.multi_context_gate',true) IS DISTINCT FROM 'approved'
  OR current_setting('syndes.restorable_backup',true) IS DISTINCT FROM 'verified'
  OR current_setting('syndes.scoped_host',true) IS DISTINCT FROM 'verified' THEN
   RAISE EXCEPTION 'Multi-context release attestation missing' USING ERRCODE='23514';
 END IF;
 FOREACH required_name IN ARRAY ARRAY[
  'platform_legacy_single_organization','platform_legacy_single_workspace',
  'crm_tags_platform_label_unique','crm_channels_platform_identity_unique',
  'inbox_platform_external_thread_unique'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_indexes
    WHERE schemaname=current_schema() AND indexname=required_name) THEN
   RAISE EXCEPTION 'Missing required safety index: %',required_name
    USING ERRCODE='23514';
  END IF;
 END LOOP;
 FOREACH required_name IN ARRAY ARRAY[
  'crm_channel_platform_owner_guard','crm_person_organizations_platform_guard',
  'crm_person_tags_platform_guard','zz_inbox_crm_owner_guard',
  'whatsapp_outbox_platform_guard','whatsapp_conversation_routes_platform_scope_guard'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_trigger
    WHERE tgname=required_name AND NOT tgisinternal AND tgenabled='O') THEN
   RAISE EXCEPTION 'Missing/inactive ownership trigger: %',required_name
    USING ERRCODE='23514';
  END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM platform_organizations o
  JOIN platform_workspaces w ON w.tenant_id=o.tenant_id
    AND w.organization_id=o.id AND w.is_default AND w.status='active'
  JOIN platform_legacy_backfill_runs b ON b.tenant_id=o.tenant_id
    AND b.organization_id=o.id
  WHERE o.is_default AND o.status='active') THEN
  RAISE EXCEPTION 'Default backfill missing' USING ERRCODE='23514';
 END IF;
 IF EXISTS(SELECT 1 FROM crm_people WHERE platform_organization_id IS NULL)
  OR EXISTS(SELECT 1 FROM crm_organizations WHERE platform_organization_id IS NULL)
  OR EXISTS(SELECT 1 FROM crm_tags WHERE platform_organization_id IS NULL)
  OR EXISTS(SELECT 1 FROM crm_channel_identities WHERE platform_organization_id IS NULL)
  OR EXISTS(SELECT 1 FROM whatsapp_accounts WHERE platform_organization_id IS NULL)
  OR EXISTS(SELECT 1 FROM inbox_conversations WHERE platform_organization_id IS NULL
   OR platform_origin_workspace_id IS NULL OR platform_current_workspace_id IS NULL) THEN
  RAISE EXCEPTION 'Unowned historical records require backfill' USING ERRCODE='23514';
 END IF;
END $guard$;

-- Every statement must be in one caller-managed transaction (psql -1).
ALTER TABLE crm_people ALTER COLUMN platform_organization_id SET NOT NULL;
ALTER TABLE crm_organizations ALTER COLUMN platform_organization_id SET NOT NULL;
ALTER TABLE crm_tags ALTER COLUMN platform_organization_id SET NOT NULL;
ALTER TABLE crm_channel_identities ALTER COLUMN platform_organization_id SET NOT NULL;
ALTER TABLE whatsapp_accounts ALTER COLUMN platform_organization_id SET NOT NULL;
ALTER TABLE inbox_conversations ALTER COLUMN platform_organization_id SET NOT NULL;
ALTER TABLE inbox_conversations ALTER COLUMN platform_origin_workspace_id SET NOT NULL;
ALTER TABLE inbox_conversations ALTER COLUMN platform_current_workspace_id SET NOT NULL;

ALTER TABLE crm_people VALIDATE CONSTRAINT crm_people_platform_owner_fk;
ALTER TABLE crm_organizations VALIDATE CONSTRAINT crm_organizations_platform_owner_fk;
ALTER TABLE crm_tags VALIDATE CONSTRAINT crm_tags_platform_owner_fk;
ALTER TABLE whatsapp_accounts VALIDATE CONSTRAINT whatsapp_accounts_platform_owner_fk;
ALTER TABLE inbox_conversations VALIDATE CONSTRAINT inbox_conversations_platform_owner_fk;
ALTER TABLE inbox_conversations VALIDATE CONSTRAINT inbox_conversations_platform_origin_fk;
ALTER TABLE inbox_conversations VALIDATE CONSTRAINT inbox_conversations_platform_current_fk;
ALTER TABLE inbox_conversations VALIDATE CONSTRAINT inbox_conversations_platform_workspace_context_check;

-- Old tenant-wide constraints are removed ONLY after per-org indexes exist.
ALTER TABLE crm_tags DROP CONSTRAINT crm_tags_tenant_id_label_key_key;
ALTER TABLE crm_channel_identities
 DROP CONSTRAINT crm_channel_identities_tenant_id_channel_external_id_key;
DROP INDEX inbox_unique_external_thread;
DROP INDEX platform_legacy_single_workspace;
DROP INDEX platform_legacy_single_organization;

DO $verify$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname=current_schema()
  AND indexname IN('platform_legacy_single_workspace',
    'platform_legacy_single_organization','inbox_unique_external_thread')) THEN
  RAISE EXCEPTION 'Old tenant-wide unique index unexpectedly remains'
   USING ERRCODE='23514';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname=current_schema()
  AND indexname='inbox_platform_external_thread_unique') THEN
  RAISE EXCEPTION 'Scoped uniqueness missing after cutover'
   USING ERRCODE='23514';
 END IF;
END $verify$;
