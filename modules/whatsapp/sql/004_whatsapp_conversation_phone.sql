-- Display metadata only: never replace recipient_external_id (WhatsApp's routing JID)
-- with a phone number. Each record remains tenant+conversation scoped.
ALTER TABLE whatsapp_conversation_routes
 ADD COLUMN IF NOT EXISTS phone_e164 varchar(16);
ALTER TABLE whatsapp_conversation_routes
 DROP CONSTRAINT IF EXISTS whatsapp_route_phone_format;
ALTER TABLE whatsapp_conversation_routes
 ADD CONSTRAINT whatsapp_route_phone_format CHECK (
 phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{9,14}$'
);
CREATE INDEX IF NOT EXISTS whatsapp_route_phone_idx
 ON whatsapp_conversation_routes(tenant_id,phone_e164)
 WHERE phone_e164 IS NOT NULL;
