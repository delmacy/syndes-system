ALTER TABLE "whatsapp_connections" ADD COLUMN IF NOT EXISTS "configured" boolean DEFAULT false NOT NULL;
ALTER TABLE "whatsapp_connections" ADD COLUMN IF NOT EXISTS "authorized" boolean DEFAULT false NOT NULL;
ALTER TABLE "whatsapp_connections" ADD COLUMN IF NOT EXISTS "service_enabled" boolean DEFAULT true NOT NULL;
ALTER TABLE "whatsapp_connections" ADD COLUMN IF NOT EXISTS "suspension_reason" text;

UPDATE "whatsapp_connections"
SET "configured" = true,
    "authorized" = ("status" = 'connected' OR "phone_external_id" IS NOT NULL),
    "service_enabled" = ("status" <> 'suspended'),
    "suspension_reason" = CASE WHEN "status" = 'suspended' THEN 'delinquency' ELSE NULL END;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_connections_authorization_check') THEN
    ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_authorization_check" CHECK (NOT "authorized" OR "configured");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_connections_connected_check') THEN
    ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_connected_check" CHECK ("status" <> 'connected' OR ("authorized" AND "service_enabled"));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_connections_suspension_check') THEN
    ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_suspension_check" CHECK (("service_enabled" AND "suspension_reason" IS NULL) OR (NOT "service_enabled" AND "status" = 'suspended' AND "suspension_reason" = 'delinquency'));
  END IF;
END $$;
