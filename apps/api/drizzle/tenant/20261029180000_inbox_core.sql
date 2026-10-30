-- INBOX-02: Inbox conversation, message and private-note persistence for
-- every tenant database (Core CRM tenants already route here server-side).
-- Reviewed DDL-only tenant migration; applied outside API startup by the
-- approved Drizzle tenant migration runner (never during API startup).
--
-- Design invariants:
-- - No tenant identifier column and no Control Plane FK: every request is
--   routed to exactly one tenant database server-side via the trusted
--   TenantContext, so tenant isolation is enforced by database routing,
--   never by client-controlled identifiers.
-- - Control Plane actor ids (assignee/author) are stored as plain uuid
--   references; no cross-database key enforcement exists or is faked. Live
--   "active same-tenant membership" validation is done server-side by the
--   Inbox API against the Control Plane before any reference is written.
-- - Private notes are a distinct resource from public messages and never
--   share the outbound channel contract (INBOX-03 consumes messages only).

CREATE TABLE "inbox_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid,
	"organization_id" uuid,
	"status" text DEFAULT 'open' NOT NULL,
	"assignee_actor_id" uuid,
	"channel" text DEFAULT 'unknown' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_conversations_status_check" CHECK ("status" IN ('open', 'pending', 'resolved')),
	CONSTRAINT "inbox_conversations_channel_check" CHECK ("channel" IN ('whatsapp', 'email', 'unknown'))
);
CREATE INDEX "inbox_conversations_person_idx" ON "inbox_conversations" USING btree ("person_id");
CREATE INDEX "inbox_conversations_organization_idx" ON "inbox_conversations" USING btree ("organization_id");
CREATE INDEX "inbox_conversations_assignee_actor_idx" ON "inbox_conversations" USING btree ("assignee_actor_id");
CREATE INDEX "inbox_conversations_status_idx" ON "inbox_conversations" USING btree ("status", "created_at", "id");

-- Conversation linkage to the canonical Core CRM customer (nullable:
-- unlinked conversations exist and are tenant_admin-only until the CRM
-- flow associates them). No tenant FK: isolation is database routing.
ALTER TABLE "inbox_conversations" ADD CONSTRAINT "inbox_conversations_person_fk" FOREIGN KEY ("person_id") REFERENCES "public"."crm_people"("id") ON DELETE SET NULL;
ALTER TABLE "inbox_conversations" ADD CONSTRAINT "inbox_conversations_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."crm_organizations"("id") ON DELETE SET NULL;

CREATE TABLE "inbox_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"body" text NOT NULL,
	"author_actor_id" uuid,
	"author_external_id" text,
	"delivery_status" text DEFAULT 'pending' NOT NULL,
	"external_id" text,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_messages_direction_check" CHECK ("direction" IN ('inbound', 'outbound')),
	CONSTRAINT "inbox_messages_body_check" CHECK ("body" <> '' AND char_length("body") <= 10000),
	CONSTRAINT "inbox_messages_delivery_status_check" CHECK ("delivery_status" IN ('pending', 'dispatched', 'failed')),
	CONSTRAINT "inbox_messages_author_actor_id_check" CHECK (
		("direction" = 'outbound' AND "author_actor_id" IS NOT NULL AND "author_external_id" IS NULL)
		OR ("direction" = 'inbound' AND "author_actor_id" IS NULL AND "author_external_id" IS NOT NULL)
	),
	CONSTRAINT "inbox_messages_author_external_id_check" CHECK ("author_external_id" IS NULL OR ("author_external_id" <> '' AND char_length("author_external_id") <= 200)),
	CONSTRAINT "inbox_messages_external_id_check" CHECK ("external_id" IS NULL OR ("external_id" <> '' AND char_length("external_id") <= 200)),
	CONSTRAINT "inbox_messages_idempotency_key_check" CHECK ("idempotency_key" IS NULL OR ("idempotency_key" <> '' AND char_length("idempotency_key") <= 200))
);
CREATE INDEX "inbox_messages_conversation_order_idx" ON "inbox_messages" USING btree ("conversation_id", "created_at", "id");
-- External channel references and retry Idempotency-Keys never duplicate a
-- message inside the same conversation (contract: retries do not duplicate).
CREATE UNIQUE INDEX "inbox_messages_conversation_external_unique" ON "inbox_messages" ("conversation_id", "external_id") WHERE "external_id" IS NOT NULL;
CREATE UNIQUE INDEX "inbox_messages_conversation_idempotency_unique" ON "inbox_messages" ("conversation_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL;

-- Message conversation FK (conversation history is root-owned data).
ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_conversation_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."inbox_conversations"("id") ON DELETE CASCADE;

CREATE TABLE "inbox_private_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"author_actor_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_private_notes_body_check" CHECK ("body" <> '' AND char_length("body") <= 10000)
);
CREATE INDEX "inbox_private_notes_conversation_order_idx" ON "inbox_private_notes" USING btree ("conversation_id", "created_at", "id");

-- Private note conversation FK (internally-only content, never dispatched
-- through the external channel port).
ALTER TABLE "inbox_private_notes" ADD CONSTRAINT "inbox_private_notes_conversation_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."inbox_conversations"("id") ON DELETE CASCADE;
