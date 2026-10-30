-- INBOX-03: durable channel-ingress idempotency for every tenant database.
--
-- The external message id is stable per channel. Scoping uniqueness to
-- ("source_channel", "external_id") — not to the conversation — makes the
-- deduplication independent of which conversation a racing delivery created:
-- a retried event can never persist a second message in another
-- conversation, and the guarantee survives API restarts because it lives in
-- the tenant database.
--
-- "source_channel" is written by the trusted ingress path (the trusted
-- TenantContext supplies the tenant/database; the product channel is
-- supplied by the trusted caller, never by the payload). Older rows keep
-- NULL and are excluded from the partial index, so this DDL is safe on an
-- existing tenant database (DDL-only, no backfill/DML).
ALTER TABLE "inbox_messages" ADD COLUMN "source_channel" text;
ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_source_channel_check" CHECK ("source_channel" IS NULL OR "source_channel" IN ('whatsapp', 'email'));
CREATE UNIQUE INDEX "inbox_messages_channel_external_unique" ON "inbox_messages" USING btree ("source_channel", "external_id") WHERE "external_id" IS NOT NULL AND "source_channel" IS NOT NULL;
