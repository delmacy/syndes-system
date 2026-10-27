-- CRM-06 Core CRM supporting entities for every tenant database.
-- Reviewed DDL-only tenant migration; applied outside API startup by the
-- approved Drizzle tenant migration runner (never during API startup).
--
-- Timeline events are append-only history rows: they keep only the event
-- kind, affected CRM identifiers, Control Plane actor id and occurrence
-- time (clock_timestamp keeps in-transaction ordering). Entity tables
-- remain canonical and no mutable CRM field is copied here.

CREATE TABLE "crm_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_tags_name_check" CHECK ("name" <> '' AND char_length("name") <= 100),
	CONSTRAINT "crm_tags_color_check" CHECK ("color" IS NULL OR "color" ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$')
);
CREATE UNIQUE INDEX "crm_tags_name_unique" ON "crm_tags" ("name");

CREATE TABLE "crm_tag_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tag_id" uuid NOT NULL,
	"person_id" uuid,
	"organization_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_tag_assignments_tag_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."crm_tags"("id"),
	CONSTRAINT "crm_tag_assignments_person_fk" FOREIGN KEY ("person_id") REFERENCES "public"."crm_people"("id"),
	CONSTRAINT "crm_tag_assignments_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."crm_organizations"("id"),
	CONSTRAINT "crm_tag_assignments_single_target_check" CHECK (("person_id" IS NOT NULL AND "organization_id" IS NULL) OR ("person_id" IS NULL AND "organization_id" IS NOT NULL))
);
CREATE INDEX "crm_tag_assignments_tag_idx" ON "crm_tag_assignments" USING btree ("tag_id");
CREATE INDEX "crm_tag_assignments_person_idx" ON "crm_tag_assignments" USING btree ("person_id");
CREATE INDEX "crm_tag_assignments_organization_idx" ON "crm_tag_assignments" USING btree ("organization_id");
CREATE UNIQUE INDEX "crm_tag_assignments_person_unique" ON "crm_tag_assignments" ("tag_id", "person_id") WHERE "person_id" IS NOT NULL;
CREATE UNIQUE INDEX "crm_tag_assignments_organization_unique" ON "crm_tag_assignments" ("tag_id", "organization_id") WHERE "organization_id" IS NOT NULL;

CREATE TABLE "crm_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid,
	"organization_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_notes_person_fk" FOREIGN KEY ("person_id") REFERENCES "public"."crm_people"("id"),
	CONSTRAINT "crm_notes_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."crm_organizations"("id"),
	CONSTRAINT "crm_notes_body_check" CHECK ("body" <> '' AND char_length("body") <= 10000),
	CONSTRAINT "crm_notes_single_target_check" CHECK (("person_id" IS NOT NULL AND "organization_id" IS NULL) OR ("person_id" IS NULL AND "organization_id" IS NOT NULL))
);
CREATE INDEX "crm_notes_person_idx" ON "crm_notes" USING btree ("person_id");
CREATE INDEX "crm_notes_organization_idx" ON "crm_notes" USING btree ("organization_id");

CREATE TABLE "crm_timeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_kind" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"person_id" uuid,
	"organization_id" uuid,
	"tag_id" uuid,
	"note_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "crm_timeline_events_person_fk" FOREIGN KEY ("person_id") REFERENCES "public"."crm_people"("id"),
	CONSTRAINT "crm_timeline_events_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."crm_organizations"("id"),
	CONSTRAINT "crm_timeline_events_tag_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."crm_tags"("id"),
	CONSTRAINT "crm_timeline_events_note_fk" FOREIGN KEY ("note_id") REFERENCES "public"."crm_notes"("id"),
	CONSTRAINT "crm_timeline_events_kind_check" CHECK ("event_kind" IN ('person.created', 'person.updated', 'person.archived', 'organization.created', 'organization.updated', 'organization.archived', 'relationship.created', 'relationship.removed', 'tag.attached', 'tag.detached', 'note.created')),
	CONSTRAINT "crm_timeline_events_target_check" CHECK ("person_id" IS NOT NULL OR "organization_id" IS NOT NULL)
);
CREATE INDEX "crm_timeline_events_person_time_idx" ON "crm_timeline_events" USING btree ("person_id", "occurred_at", "id");
CREATE INDEX "crm_timeline_events_organization_time_idx" ON "crm_timeline_events" USING btree ("organization_id", "occurred_at", "id");
CREATE INDEX "crm_timeline_events_kind_idx" ON "crm_timeline_events" USING btree ("event_kind");
CREATE FUNCTION "public"."reject_crm_timeline_event_mutation"() RETURNS trigger
	LANGUAGE plpgsql
	AS $$ BEGIN RAISE EXCEPTION 'crm_timeline_events are append-only' USING ERRCODE = '23514'; END; $$;
CREATE TRIGGER "crm_timeline_events_append_only"
	BEFORE UPDATE OR DELETE ON "crm_timeline_events"
	FOR EACH ROW EXECUTE FUNCTION "public"."reject_crm_timeline_event_mutation"();

CREATE TABLE "crm_channel_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"external_id" text NOT NULL,
	"external_username" text,
	"push_name" text,
	"business_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_channel_identities_person_fk" FOREIGN KEY ("person_id") REFERENCES "public"."crm_people"("id"),
	CONSTRAINT "crm_channel_identities_channel_check" CHECK ("channel" IN ('whatsapp')),
	CONSTRAINT "crm_channel_identities_external_id_check" CHECK ("external_id" <> '' AND char_length("external_id") <= 200),
	CONSTRAINT "crm_channel_identities_external_username_check" CHECK ("external_username" IS NULL OR ("external_username" <> '' AND char_length("external_username") <= 200)),
	CONSTRAINT "crm_channel_identities_push_name_check" CHECK ("push_name" IS NULL OR ("push_name" <> '' AND char_length("push_name") <= 200)),
	CONSTRAINT "crm_channel_identities_business_name_check" CHECK ("business_name" IS NULL OR ("business_name" <> '' AND char_length("business_name") <= 200))
);
CREATE INDEX "crm_channel_identities_person_idx" ON "crm_channel_identities" USING btree ("person_id");
CREATE UNIQUE INDEX "crm_channel_identities_channel_external_unique" ON "crm_channel_identities" ("channel", "external_id");
