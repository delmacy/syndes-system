-- Stage C3: prohibit a WhatsApp route that joins an account belonging to one
-- platform organization with an Inbox conversation owned by another.
-- Run AFTER 003_legacy_ownership.sql, never modify old migration checksums.
-- The preflight does not erase or silently rebind existing records.
DO $preflight$
BEGIN
 IF EXISTS (
   SELECT 1 FROM whatsapp_conversation_routes r
   JOIN whatsapp_accounts a ON a.tenant_id=r.tenant_id AND a.id=r.account_id
   JOIN inbox_conversations c ON c.tenant_id=r.tenant_id AND c.id=r.conversation_id
   WHERE a.platform_organization_id IS NOT NULL
     AND c.platform_organization_id IS NOT NULL
     AND a.platform_organization_id<>c.platform_organization_id
 ) THEN
   RAISE EXCEPTION 'WhatsApp route crosses platform organizations; manual review required'
    USING ERRCODE='23514';
 END IF;
END $preflight$;

CREATE OR REPLACE FUNCTION platform_validate_whatsapp_route_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $function$
DECLARE
 account_owner uuid;
 conversation_owner uuid;
BEGIN
 IF TG_OP='UPDATE' AND
    (NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.account_id IS DISTINCT FROM OLD.account_id
     OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id) THEN
   RAISE EXCEPTION 'WhatsApp route identity is immutable' USING ERRCODE='23514';
 END IF;
 SELECT platform_organization_id INTO account_owner
 FROM whatsapp_accounts WHERE tenant_id=NEW.tenant_id AND id=NEW.account_id;
 SELECT platform_organization_id INTO conversation_owner
 FROM inbox_conversations WHERE tenant_id=NEW.tenant_id AND id=NEW.conversation_id;
 IF account_owner IS NULL OR conversation_owner IS NULL OR account_owner<>conversation_owner THEN
  RAISE EXCEPTION 'WhatsApp route organization owner mismatch'
    USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $function$;

DO $trigger$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger
   WHERE tgname='whatsapp_conversation_routes_platform_scope_guard'
    AND tgrelid='whatsapp_conversation_routes'::regclass) THEN
   CREATE TRIGGER whatsapp_conversation_routes_platform_scope_guard
   BEFORE INSERT OR UPDATE ON whatsapp_conversation_routes
   FOR EACH ROW EXECUTE FUNCTION platform_validate_whatsapp_route_owner();
 END IF;
END $trigger$;
