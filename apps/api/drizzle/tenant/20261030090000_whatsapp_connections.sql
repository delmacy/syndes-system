CREATE TABLE IF NOT EXISTS "whatsapp_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "singleton_key" text DEFAULT 'default' NOT NULL UNIQUE,
  "provider" text DEFAULT 'whatsmeow' NOT NULL,
  "status" text DEFAULT 'disconnected' NOT NULL,
  "phone_external_id" text,
  "session_secret_ref" text,
  "configured" boolean DEFAULT false NOT NULL,
  "authorized" boolean DEFAULT false NOT NULL,
  "service_enabled" boolean DEFAULT true NOT NULL,
  "suspension_reason" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "whatsapp_connections_provider_check" CHECK ("whatsapp_connections"."provider" IN ('fake', 'whatsmeow')),
  CONSTRAINT "whatsapp_connections_status_check" CHECK ("whatsapp_connections"."status" IN ('disconnected', 'pairing', 'connected', 'suspended', 'error')),
  CONSTRAINT "whatsapp_connections_authorization_check" CHECK (NOT "whatsapp_connections"."authorized" OR "whatsapp_connections"."configured"),
  CONSTRAINT "whatsapp_connections_connected_check" CHECK ("whatsapp_connections"."status" <> 'connected' OR ("whatsapp_connections"."authorized" AND "whatsapp_connections"."service_enabled")),
  CONSTRAINT "whatsapp_connections_suspension_check" CHECK (("whatsapp_connections"."service_enabled" AND "whatsapp_connections"."suspension_reason" IS NULL) OR (NOT "whatsapp_connections"."service_enabled" AND "whatsapp_connections"."status" = 'suspended' AND "whatsapp_connections"."suspension_reason" = 'delinquency'))
);
CREATE INDEX IF NOT EXISTS "whatsapp_connections_status_idx" ON "whatsapp_connections" ("status");
