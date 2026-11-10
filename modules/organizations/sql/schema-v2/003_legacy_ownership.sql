-- CANDIDATE ONLY (AK-40.01). NOT wired into the legacy Host migration manifest.
-- Generated from sql/003_legacy_ownership.sql; do not edit this output by hand.
-- Requires separately installed CRM/Inbox/WhatsApp schemas and approved AK-30 installer.
-- SM-F1.0c / Stage B: safe, nullable owner bindings for legacy CRM, Inbox
-- and WhatsApp records. Applied after CRM, Inbox, WhatsApp and platform 001/002.
-- CRITICAL: this does NOT enable a second Organization/Workspace.
-- 002_legacy_single_context_gate.sql MUST remain installed.
-- The owner binding cannot replace server-side org/workspace ACL at Stage C.

-- Canonical CRM subjects and tags belong to a company. Existing relations,
-- employees, notes and channels inherit visibility from their parent records.
ALTER TABLE crm.crm_people ADD COLUMN IF NOT EXISTS platform_organization_id UUID;
ALTER TABLE crm.crm_organizations ADD COLUMN IF NOT EXISTS platform_organization_id UUID;
ALTER TABLE crm.crm_tags ADD COLUMN IF NOT EXISTS platform_organization_id UUID;

-- Inbox has one immutable owning organization and originating workspace;
-- a future authorized transfer may change only the current workspace.
-- The continuous WhatsApp history is still attached to the conversation ID.
ALTER TABLE inbox.inbox_conversations ADD COLUMN IF NOT EXISTS platform_organization_id UUID;
ALTER TABLE inbox.inbox_conversations ADD COLUMN IF NOT EXISTS platform_origin_workspace_id UUID;
ALTER TABLE inbox.inbox_conversations ADD COLUMN IF NOT EXISTS platform_current_workspace_id UUID;

-- WhatsApp phone/account belongs to a company, not a unit, employee or Site.
-- All provider events, outbox, contact names and route links inherit from
-- their (tenant,account_id) parent; the historical IDs remain unchanged.
ALTER TABLE whatsapp.whatsapp_accounts ADD COLUMN IF NOT EXISTS platform_organization_id UUID;

-- Add composite owner foreign keys in a backward-compatible, NOT VALID form:
-- they are enforced for all new values, but legacy NULLs remain until backfill.
-- Future Stage C must validate and enforce NOT NULL after every old row is bound.
DO $migration$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='crm_people_platform_owner_fk' AND conrelid='crm.crm_people'::regclass) THEN
  ALTER TABLE crm.crm_people ADD CONSTRAINT crm_people_platform_owner_fk
    FOREIGN KEY(tenant_id,platform_organization_id)
    REFERENCES organizations.platform_organizations(tenant_id,id) NOT VALID;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='crm_organizations_platform_owner_fk' AND conrelid='crm.crm_organizations'::regclass) THEN
  ALTER TABLE crm.crm_organizations ADD CONSTRAINT crm_organizations_platform_owner_fk
    FOREIGN KEY(tenant_id,platform_organization_id)
    REFERENCES organizations.platform_organizations(tenant_id,id) NOT VALID;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='crm_tags_platform_owner_fk' AND conrelid='crm.crm_tags'::regclass) THEN
  ALTER TABLE crm.crm_tags ADD CONSTRAINT crm_tags_platform_owner_fk
    FOREIGN KEY(tenant_id,platform_organization_id)
    REFERENCES organizations.platform_organizations(tenant_id,id) NOT VALID;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='inbox_conversations_platform_owner_fk' AND conrelid='inbox.inbox_conversations'::regclass) THEN
  ALTER TABLE inbox.inbox_conversations ADD CONSTRAINT inbox_conversations_platform_owner_fk
    FOREIGN KEY(tenant_id,platform_organization_id)
    REFERENCES organizations.platform_organizations(tenant_id,id) NOT VALID;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='inbox_conversations_platform_origin_fk' AND conrelid='inbox.inbox_conversations'::regclass) THEN
  ALTER TABLE inbox.inbox_conversations ADD CONSTRAINT inbox_conversations_platform_origin_fk
    FOREIGN KEY(tenant_id,platform_organization_id,platform_origin_workspace_id)
    REFERENCES organizations.platform_workspaces(tenant_id,organization_id,id) NOT VALID;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='inbox_conversations_platform_current_fk' AND conrelid='inbox.inbox_conversations'::regclass) THEN
  ALTER TABLE inbox.inbox_conversations ADD CONSTRAINT inbox_conversations_platform_current_fk
    FOREIGN KEY(tenant_id,platform_organization_id,platform_current_workspace_id)
    REFERENCES organizations.platform_workspaces(tenant_id,organization_id,id) NOT VALID;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='whatsapp_accounts_platform_owner_fk' AND conrelid='whatsapp.whatsapp_accounts'::regclass) THEN
  ALTER TABLE whatsapp.whatsapp_accounts ADD CONSTRAINT whatsapp_accounts_platform_owner_fk
    FOREIGN KEY(tenant_id,platform_organization_id)
    REFERENCES organizations.platform_organizations(tenant_id,id) NOT VALID;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='inbox_conversations_platform_workspace_context_check' AND conrelid='inbox.inbox_conversations'::regclass) THEN
  ALTER TABLE inbox.inbox_conversations
    ADD CONSTRAINT inbox_conversations_platform_workspace_context_check
    CHECK(
      (platform_origin_workspace_id IS NULL OR platform_organization_id IS NOT NULL)
      AND (platform_current_workspace_id IS NULL OR platform_organization_id IS NOT NULL)
    ) NOT VALID;
 END IF;
END
$migration$;

CREATE INDEX IF NOT EXISTS crm_people_platform_owner_idx
 ON crm.crm_people(tenant_id,platform_organization_id,id);
CREATE INDEX IF NOT EXISTS crm_organizations_platform_owner_idx
 ON crm.crm_organizations(tenant_id,platform_organization_id,id);
CREATE INDEX IF NOT EXISTS crm_tags_platform_owner_idx
 ON crm.crm_tags(tenant_id,platform_organization_id,id);
CREATE INDEX IF NOT EXISTS inbox_conversations_platform_owner_idx
 ON inbox.inbox_conversations(tenant_id,platform_organization_id,platform_current_workspace_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_accounts_platform_owner_idx
 ON whatsapp.whatsapp_accounts(tenant_id,platform_organization_id,id);

-- Owner is immutable once set. In pre-bootstrap legacy mode a NULL owner may
-- exist; after bootstrap, new inserts and updates inherit the sole default
-- Organization. Do not preserve this implicit default when Stage C introduces
-- multiple organizations; replace it with explicit actor-scoped ownership.
CREATE OR REPLACE FUNCTION organizations.platform_legacy_fill_org_owner()
RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog AS $function$
BEGIN
 IF TG_OP='UPDATE' AND OLD.platform_organization_id IS NOT NULL
    AND NEW.platform_organization_id IS DISTINCT FROM OLD.platform_organization_id THEN
   RAISE EXCEPTION 'Platform organization owner is immutable'
      USING ERRCODE='23514';
 END IF;
 IF NEW.platform_organization_id IS NULL THEN
   SELECT o.id INTO NEW.platform_organization_id
   FROM organizations.platform_organizations o
   WHERE o.tenant_id=NEW.tenant_id AND o.is_default=true AND o.status='active';
 END IF;
 RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION organizations.platform_legacy_fill_inbox_owner()
RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog AS $function$
BEGIN
 IF TG_OP='UPDATE' AND OLD.platform_organization_id IS NOT NULL
    AND NEW.platform_organization_id IS DISTINCT FROM OLD.platform_organization_id THEN
   RAISE EXCEPTION 'Inbox organization owner is immutable' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' AND OLD.platform_origin_workspace_id IS NOT NULL
    AND NEW.platform_origin_workspace_id IS DISTINCT FROM OLD.platform_origin_workspace_id THEN
   RAISE EXCEPTION 'Inbox origin workspace is immutable' USING ERRCODE='23514';
 END IF;
 IF NEW.platform_organization_id IS NULL THEN
   SELECT o.id INTO NEW.platform_organization_id
   FROM organizations.platform_organizations o
   WHERE o.tenant_id=NEW.tenant_id AND o.is_default AND o.status='active';
 END IF;
 IF NEW.platform_origin_workspace_id IS NULL THEN
   SELECT w.id INTO NEW.platform_origin_workspace_id
   FROM organizations.platform_workspaces w
   WHERE w.tenant_id=NEW.tenant_id AND w.organization_id=NEW.platform_organization_id
     AND w.is_default AND w.status='active';
 END IF;
 IF NEW.platform_current_workspace_id IS NULL THEN
   NEW.platform_current_workspace_id:=NEW.platform_origin_workspace_id;
 END IF;
 RETURN NEW;
END
$function$;

DO $triggers$
DECLARE t TEXT;
BEGIN
 FOREACH t IN ARRAY ARRAY['crm_people','crm_organizations','crm_tags','whatsapp_accounts'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname=t||'_platform_owner_trigger'
      AND tgrelid=to_regclass(CASE WHEN t='whatsapp_accounts' THEN 'whatsapp.'||t ELSE 'crm.'||t END)) THEN
   EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %I.%I
     FOR EACH ROW EXECUTE FUNCTION organizations.platform_legacy_fill_org_owner()',
       t||'_platform_owner_trigger',
       CASE WHEN t='whatsapp_accounts' THEN 'whatsapp' ELSE 'crm' END,t);
  END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger
      WHERE tgname='inbox_conversations_platform_owner_trigger'
      AND tgrelid='inbox.inbox_conversations'::regclass) THEN
  CREATE TRIGGER inbox_conversations_platform_owner_trigger
    BEFORE INSERT OR UPDATE ON inbox.inbox_conversations
    FOR EACH ROW EXECUTE FUNCTION organizations.platform_legacy_fill_inbox_owner();
 END IF;
END
$triggers$;

-- Keep an append-only audit of privileged backfill operations (counts only).
-- Never store personal names, message bodies or WhatsApp identifiers.
CREATE TABLE IF NOT EXISTS organizations.platform_legacy_backfill_runs(
 tenant_id UUID NOT NULL,
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 organization_id UUID NOT NULL,
 actor_id TEXT NOT NULL CHECK(length(actor_id) BETWEEN 1 AND 256),
 counts JSONB NOT NULL,
 recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(tenant_id,organization_id)
   REFERENCES organizations.platform_organizations(tenant_id,id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS platform_legacy_backfill_runs_by_tenant
 ON organizations.platform_legacy_backfill_runs(tenant_id,recorded_at DESC);

-- A single SQL transaction binds ALL existing records to one default context,
-- or fails closed. The caller is authenticated by the Core Host AND must be a
-- current default-organization administrator (checked by the service query).
-- Do not log PII or message content. Results are counts only.
CREATE OR REPLACE FUNCTION organizations.platform_backfill_legacy_ownership(p_tenant UUID,p_actor TEXT)
RETURNS TABLE(entity_type TEXT, updated_count BIGINT)
LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog AS $function$
DECLARE
 org UUID;
 ws UUID;
 changed BIGINT;
 stats JSONB:='{}'::JSONB;
BEGIN
 IF p_actor IS NULL OR length(p_actor) NOT BETWEEN 1 AND 256 THEN
   RAISE EXCEPTION 'Invalid backfill actor' USING ERRCODE='23514';
 END IF;
 -- Cooperative per-tenant lock avoids overlapping administrative backfills.
 PERFORM pg_advisory_xact_lock(hashtextextended('syndes-backfill-'||p_tenant::text,0));
 SELECT o.id,w.id INTO org,ws
 FROM organizations.platform_organizations o
 JOIN organizations.platform_workspaces w ON w.tenant_id=o.tenant_id AND w.organization_id=o.id
 WHERE o.tenant_id=p_tenant AND o.is_default AND o.status='active'
   AND w.is_default AND w.status='active';
 IF org IS NULL OR ws IS NULL THEN
   RAISE EXCEPTION 'Default organization/workspace missing' USING ERRCODE='P0001';
 END IF;
 -- The 002 unique indexes must exist while legacy queries are tenant-scoped.
 IF NOT EXISTS(SELECT 1 FROM pg_indexes
     WHERE schemaname='organizations'
       AND indexname='platform_legacy_single_organization')
    OR NOT EXISTS(SELECT 1 FROM pg_indexes
     WHERE schemaname='organizations'
       AND indexname='platform_legacy_single_workspace') THEN
   RAISE EXCEPTION 'Legacy single-context guard missing' USING ERRCODE='P0001';
 END IF;
 IF EXISTS(
   SELECT 1 FROM crm.crm_people WHERE tenant_id=p_tenant
      AND platform_organization_id IS DISTINCT FROM org
      AND platform_organization_id IS NOT NULL
 ) OR EXISTS(
   SELECT 1 FROM crm.crm_organizations WHERE tenant_id=p_tenant
      AND platform_organization_id IS DISTINCT FROM org
      AND platform_organization_id IS NOT NULL
 ) OR EXISTS(
   SELECT 1 FROM crm.crm_tags WHERE tenant_id=p_tenant
      AND platform_organization_id IS DISTINCT FROM org
      AND platform_organization_id IS NOT NULL
 ) OR EXISTS(
   SELECT 1 FROM inbox.inbox_conversations WHERE tenant_id=p_tenant
      AND (platform_organization_id IS NOT NULL AND platform_organization_id<>org
        OR platform_origin_workspace_id IS NOT NULL AND platform_origin_workspace_id<>ws
        OR platform_current_workspace_id IS NOT NULL AND platform_current_workspace_id<>ws)
 ) OR EXISTS(
   SELECT 1 FROM whatsapp.whatsapp_accounts WHERE tenant_id=p_tenant
      AND platform_organization_id IS NOT NULL
      AND platform_organization_id<>org
 ) THEN
   RAISE EXCEPTION 'Conflicting legacy owner; manual review required'
      USING ERRCODE='23514';
 END IF;
 UPDATE crm.crm_people SET platform_organization_id=org
 WHERE tenant_id=p_tenant AND platform_organization_id IS NULL;
 GET DIAGNOSTICS changed=ROW_COUNT;
 stats:=stats || jsonb_build_object('crm_people',changed);
 RETURN QUERY SELECT 'crm_people'::TEXT,changed;

 UPDATE crm.crm_organizations SET platform_organization_id=org
 WHERE tenant_id=p_tenant AND platform_organization_id IS NULL;
 GET DIAGNOSTICS changed=ROW_COUNT;
 stats:=stats || jsonb_build_object('crm_organizations',changed);
 RETURN QUERY SELECT 'crm_organizations'::TEXT,changed;

 UPDATE crm.crm_tags SET platform_organization_id=org
 WHERE tenant_id=p_tenant AND platform_organization_id IS NULL;
 GET DIAGNOSTICS changed=ROW_COUNT;
 stats:=stats || jsonb_build_object('crm_tags',changed);
 RETURN QUERY SELECT 'crm_tags'::TEXT,changed;

 UPDATE inbox.inbox_conversations SET platform_organization_id=org,
   platform_origin_workspace_id=ws,platform_current_workspace_id=ws
 WHERE tenant_id=p_tenant AND (platform_organization_id IS NULL
   OR platform_origin_workspace_id IS NULL OR platform_current_workspace_id IS NULL);
 GET DIAGNOSTICS changed=ROW_COUNT;
 stats:=stats || jsonb_build_object('inbox_conversations',changed);
 RETURN QUERY SELECT 'inbox_conversations'::TEXT,changed;

 UPDATE whatsapp.whatsapp_accounts SET platform_organization_id=org
 WHERE tenant_id=p_tenant AND platform_organization_id IS NULL;
 GET DIAGNOSTICS changed=ROW_COUNT;
 stats:=stats || jsonb_build_object('whatsapp_accounts',changed);
 RETURN QUERY SELECT 'whatsapp_accounts'::TEXT,changed;
 INSERT INTO organizations.platform_legacy_backfill_runs(tenant_id,organization_id,actor_id,counts)
 VALUES(p_tenant,org,p_actor,stats);
END
$function$;
