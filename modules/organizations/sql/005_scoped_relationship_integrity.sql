-- Stage C5 — scoped relationship integrity. Deploy AFTER 003/004.
-- Additive and replay-safe; never removes the physical 002 safety gate.
-- Existing historical IDs are preserved. NULL legacy owners are accepted
-- ONLY while both migration 002 unique indexes still exist.
ALTER TABLE crm_channel_identities
  ADD COLUMN IF NOT EXISTS platform_organization_id UUID;

UPDATE crm_channel_identities ci SET platform_organization_id=p.platform_organization_id
FROM crm_people p
WHERE p.tenant_id=ci.tenant_id AND p.id=ci.person_id
  AND ci.platform_organization_id IS NULL
  AND p.platform_organization_id IS NOT NULL;

DO $preflight$
BEGIN
 IF EXISTS (
  SELECT 1 FROM crm_channel_identities ci
  JOIN crm_people p ON p.tenant_id=ci.tenant_id AND p.id=ci.person_id
  WHERE ci.platform_organization_id IS NOT NULL
    AND ci.platform_organization_id IS DISTINCT FROM p.platform_organization_id
 ) THEN
  RAISE EXCEPTION 'CRM channel identity owner mismatch; manual review required'
   USING ERRCODE='23514';
 END IF;
 IF EXISTS(
  SELECT 1 FROM crm_person_organizations po
  JOIN crm_people p ON p.tenant_id=po.tenant_id AND p.id=po.person_id
  JOIN crm_organizations o ON o.tenant_id=po.tenant_id AND o.id=po.organization_id
  WHERE p.platform_organization_id IS NOT NULL
    AND o.platform_organization_id IS NOT NULL
    AND p.platform_organization_id<>o.platform_organization_id
 ) OR EXISTS(
  SELECT 1 FROM crm_person_tags pt
  JOIN crm_people p ON p.tenant_id=pt.tenant_id AND p.id=pt.person_id
  JOIN crm_tags t ON t.tenant_id=pt.tenant_id AND t.id=pt.tag_id
  WHERE p.platform_organization_id IS NOT NULL
    AND t.platform_organization_id IS NOT NULL
    AND p.platform_organization_id<>t.platform_organization_id
 ) OR EXISTS(
  SELECT 1 FROM inbox_conversations c
  JOIN crm_people p ON p.tenant_id=c.tenant_id AND p.id=c.crm_person_id
  WHERE c.platform_organization_id IS NOT NULL
    AND p.platform_organization_id IS NOT NULL
    AND c.platform_organization_id<>p.platform_organization_id
 ) OR EXISTS(
  SELECT 1 FROM whatsapp_outbox outbox
  JOIN whatsapp_accounts a ON a.tenant_id=outbox.tenant_id AND a.id=outbox.account_id
  JOIN inbox_messages m ON m.tenant_id=outbox.tenant_id AND m.id=outbox.inbox_message_id
  JOIN inbox_conversations c ON c.tenant_id=m.tenant_id AND c.id=m.conversation_id
  WHERE a.platform_organization_id IS NOT NULL
    AND c.platform_organization_id IS NOT NULL
    AND a.platform_organization_id<>c.platform_organization_id
 ) THEN
  RAISE EXCEPTION 'Existing cross-organization relation; manual review required'
   USING ERRCODE='23514';
 END IF;
END $preflight$;

-- Owner-scoped unique keys for the subsequent Product Gate migration.
-- Do NOT drop the old tenant-wide uniqueness constraints here; their
-- removal must coincide with deliberate multi-organization activation.
CREATE UNIQUE INDEX IF NOT EXISTS crm_tags_platform_label_unique
  ON crm_tags(tenant_id,platform_organization_id,label_key);
CREATE UNIQUE INDEX IF NOT EXISTS crm_channels_platform_identity_unique
  ON crm_channel_identities(tenant_id,platform_organization_id,channel,external_id);
CREATE UNIQUE INDEX IF NOT EXISTS inbox_platform_external_thread_unique
  ON inbox_conversations(tenant_id,platform_organization_id,channel,external_thread_id)
  WHERE external_thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_channels_platform_owner_idx
  ON crm_channel_identities(tenant_id,platform_organization_id,person_id);

-- The original legacy default triggers are safe only with 002 installed.
-- Once the physical gate is removed, every write MUST include an explicit
-- owning organization and the original workspace. Never silently reassign
-- a new record to the default when multiple organizations exist.
CREATE OR REPLACE FUNCTION platform_legacy_fill_org_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $function$
BEGIN
 IF TG_OP='UPDATE' AND OLD.platform_organization_id IS NOT NULL
   AND NEW.platform_organization_id IS DISTINCT FROM OLD.platform_organization_id THEN
  RAISE EXCEPTION 'Platform organization owner is immutable' USING ERRCODE='23514';
 END IF;
 IF NEW.platform_organization_id IS NULL THEN
  IF NOT EXISTS(SELECT 1 FROM pg_indexes
     WHERE schemaname=current_schema() AND indexname='platform_legacy_single_organization')
    OR NOT EXISTS(SELECT 1 FROM pg_indexes
     WHERE schemaname=current_schema() AND indexname='platform_legacy_single_workspace') THEN
    RAISE EXCEPTION 'Explicit platform owner required' USING ERRCODE='23514';
  END IF;
  SELECT o.id INTO NEW.platform_organization_id
  FROM platform_organizations o
  WHERE o.tenant_id=NEW.tenant_id AND o.is_default AND o.status='active';
 END IF;
 RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION platform_legacy_fill_inbox_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $function$
BEGIN
 IF TG_OP='UPDATE' AND OLD.platform_organization_id IS NOT NULL
   AND NEW.platform_organization_id IS DISTINCT FROM OLD.platform_organization_id THEN
  RAISE EXCEPTION 'Inbox organization owner is immutable' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' AND OLD.platform_origin_workspace_id IS NOT NULL
   AND NEW.platform_origin_workspace_id IS DISTINCT FROM OLD.platform_origin_workspace_id THEN
  RAISE EXCEPTION 'Inbox origin workspace is immutable' USING ERRCODE='23514';
 END IF;
 IF NEW.platform_organization_id IS NULL OR NEW.platform_origin_workspace_id IS NULL THEN
  IF NOT EXISTS(SELECT 1 FROM pg_indexes
    WHERE schemaname=current_schema() AND indexname='platform_legacy_single_organization')
   OR NOT EXISTS(SELECT 1 FROM pg_indexes
    WHERE schemaname=current_schema() AND indexname='platform_legacy_single_workspace') THEN
   RAISE EXCEPTION 'Explicit conversation organization and origin required'
    USING ERRCODE='23514';
  END IF;
 END IF;
 IF NEW.platform_organization_id IS NULL THEN
   SELECT id INTO NEW.platform_organization_id FROM platform_organizations
   WHERE tenant_id=NEW.tenant_id AND is_default AND status='active';
 END IF;
 IF NEW.platform_origin_workspace_id IS NULL THEN
   SELECT id INTO NEW.platform_origin_workspace_id FROM platform_workspaces
   WHERE tenant_id=NEW.tenant_id AND organization_id=NEW.platform_organization_id
     AND is_default AND status='active';
 END IF;
 IF NEW.platform_current_workspace_id IS NULL
   THEN NEW.platform_current_workspace_id:=NEW.platform_origin_workspace_id;
 END IF;
 RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION platform_validate_crm_channel_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $function$
DECLARE owner uuid;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.person_id IS DISTINCT FROM OLD.person_id
    OR NEW.platform_organization_id IS DISTINCT FROM OLD.platform_organization_id) THEN
    RAISE EXCEPTION 'CRM channel owner/person identity is immutable' USING ERRCODE='23514';
 END IF;
 SELECT p.platform_organization_id INTO owner
 FROM crm_people p WHERE p.tenant_id=NEW.tenant_id AND p.id=NEW.person_id;
 IF NEW.platform_organization_id IS NULL THEN NEW.platform_organization_id:=owner; END IF;
 IF owner IS DISTINCT FROM NEW.platform_organization_id THEN
  RAISE EXCEPTION 'CRM channel organization mismatch' USING ERRCODE='23514';
 END IF;
 IF owner IS NULL AND
   (NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname=current_schema()
     AND indexname='platform_legacy_single_organization')
    OR NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname=current_schema()
     AND indexname='platform_legacy_single_workspace')) THEN
  RAISE EXCEPTION 'CRM channel owner required' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION platform_validate_crm_relationship()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $function$
DECLARE p_owner uuid;linked_owner uuid;
BEGIN
 SELECT platform_organization_id INTO p_owner FROM crm_people
  WHERE tenant_id=NEW.tenant_id AND id=NEW.person_id;
 IF TG_TABLE_NAME='crm_person_organizations' THEN
   SELECT platform_organization_id INTO linked_owner FROM crm_organizations
    WHERE tenant_id=NEW.tenant_id AND id=NEW.organization_id;
 ELSIF TG_TABLE_NAME='crm_person_tags' THEN
   SELECT platform_organization_id INTO linked_owner FROM crm_tags
    WHERE tenant_id=NEW.tenant_id AND id=NEW.tag_id;
 ELSE RAISE EXCEPTION 'Invalid CRM relationship table' USING ERRCODE='23514';
 END IF;
 IF p_owner IS DISTINCT FROM linked_owner THEN
  RAISE EXCEPTION 'CRM relation crosses organizations' USING ERRCODE='23514';
 END IF;
 IF p_owner IS NULL AND
   (NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname=current_schema()
     AND indexname='platform_legacy_single_organization')
    OR NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname=current_schema()
     AND indexname='platform_legacy_single_workspace')) THEN
  RAISE EXCEPTION 'CRM relation requires explicit organization' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION platform_validate_inbox_crm_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $function$
DECLARE owner uuid;
BEGIN
 IF NEW.crm_person_id IS NULL THEN RETURN NEW; END IF;
 SELECT p.platform_organization_id INTO owner FROM crm_people p
 WHERE p.tenant_id=NEW.tenant_id AND p.id=NEW.crm_person_id;
 IF NEW.platform_organization_id IS DISTINCT FROM owner THEN
  RAISE EXCEPTION 'Inbox CRM person crosses organizations' USING ERRCODE='23514';
 END IF;
 IF owner IS NULL AND
   (NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname=current_schema()
     AND indexname='platform_legacy_single_organization')
    OR NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname=current_schema()
     AND indexname='platform_legacy_single_workspace')) THEN
  RAISE EXCEPTION 'Inbox CRM person owner required' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION platform_validate_whatsapp_outbox_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $function$
DECLARE account_owner uuid;message_owner uuid;
BEGIN
 IF NEW.inbox_message_id IS NULL THEN RETURN NEW; END IF;
 SELECT a.platform_organization_id INTO account_owner FROM whatsapp_accounts a
  WHERE a.tenant_id=NEW.tenant_id AND a.id=NEW.account_id;
 SELECT c.platform_organization_id INTO message_owner FROM inbox_messages m
 JOIN inbox_conversations c ON c.tenant_id=m.tenant_id AND c.id=m.conversation_id
 WHERE m.tenant_id=NEW.tenant_id AND m.id=NEW.inbox_message_id;
 IF account_owner IS NULL OR message_owner IS NULL OR account_owner<>message_owner THEN
  RAISE EXCEPTION 'WhatsApp outbox message crosses organizations' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $function$;

DO $install$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='crm_channel_platform_owner_guard'
   AND tgrelid='crm_channel_identities'::regclass) THEN
  CREATE TRIGGER crm_channel_platform_owner_guard
   BEFORE INSERT OR UPDATE ON crm_channel_identities
   FOR EACH ROW EXECUTE FUNCTION platform_validate_crm_channel_owner();
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='crm_person_organizations_platform_guard'
   AND tgrelid='crm_person_organizations'::regclass) THEN
  CREATE TRIGGER crm_person_organizations_platform_guard
   BEFORE INSERT OR UPDATE ON crm_person_organizations
   FOR EACH ROW EXECUTE FUNCTION platform_validate_crm_relationship();
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='crm_person_tags_platform_guard'
   AND tgrelid='crm_person_tags'::regclass) THEN
  CREATE TRIGGER crm_person_tags_platform_guard
   BEFORE INSERT OR UPDATE ON crm_person_tags
   FOR EACH ROW EXECUTE FUNCTION platform_validate_crm_relationship();
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='zz_inbox_crm_owner_guard'
   AND tgrelid='inbox_conversations'::regclass) THEN
  CREATE TRIGGER zz_inbox_crm_owner_guard
   BEFORE INSERT OR UPDATE ON inbox_conversations
   FOR EACH ROW EXECUTE FUNCTION platform_validate_inbox_crm_owner();
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='whatsapp_outbox_platform_guard'
   AND tgrelid='whatsapp_outbox'::regclass) THEN
  CREATE TRIGGER whatsapp_outbox_platform_guard
   BEFORE INSERT OR UPDATE ON whatsapp_outbox
   FOR EACH ROW EXECUTE FUNCTION platform_validate_whatsapp_outbox_owner();
 END IF;
END $install$;
