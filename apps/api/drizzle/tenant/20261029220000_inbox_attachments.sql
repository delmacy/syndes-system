-- INBOX-04: private attachment metadata for every tenant database.
--
-- Bytes are NEVER stored here and never under a web-served directory. The
-- API writes them through `InboxAttachmentStorage` into a private,
-- per-tenant directory outside any webroot, and serves them only through an
-- authorized download endpoint. This table keeps the durable metadata:
-- conversation scope, server-generated object key, display filename,
-- normalized content type, size and SHA-256 for integrity verification.
--
-- Invariants enforced by the database itself:
-- - `object_key` matches `<tenant uuid>/<random uuid>.<extension>`; a client
--   filename, path separator or `..` can never be persisted as a storage
--   location, even by an out-of-band writer;
-- - the display filename is sanitized (no path separators) and bounded;
-- - content type is a lower-case MIME identifier (the allowlist itself is
--   configuration, so changing it does not require a migration);
-- - size is positive and cannot exceed the reviewed hard ceiling (25 MiB);
-- - every attachment belongs to one conversation and is deleted with it.
-- No tenant/Control Plane FK column exists: isolation is enforced by routing
-- every request to the server-resolved tenant database.

CREATE TABLE "inbox_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"sha256" text NOT NULL,
	"uploaded_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_attachments_object_key_check" CHECK ("object_key" ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.][a-z0-9]{1,10}$'),
	CONSTRAINT "inbox_attachments_filename_check" CHECK ("original_filename" <> '' AND char_length("original_filename") <= 255 AND position('/' in "original_filename") = 0 AND position(chr(92) in "original_filename") = 0),
	CONSTRAINT "inbox_attachments_content_type_check" CHECK ("content_type" ~ '^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$'),
	CONSTRAINT "inbox_attachments_byte_size_check" CHECK ("byte_size" > 0 AND "byte_size" <= 26214400),
	CONSTRAINT "inbox_attachments_sha256_check" CHECK ("sha256" ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX "inbox_attachments_object_key_unique" ON "inbox_attachments" USING btree ("object_key");
CREATE INDEX "inbox_attachments_conversation_order_idx" ON "inbox_attachments" USING btree ("conversation_id", "created_at", "id");
ALTER TABLE "inbox_attachments" ADD CONSTRAINT "inbox_attachments_conversation_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."inbox_conversations"("id") ON DELETE CASCADE;
