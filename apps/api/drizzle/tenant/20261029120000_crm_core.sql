-- CRM-05 Core CRM baseline entities for every tenant database.
-- Reviewed DDL-only tenant migration; applied outside API startup by the
-- approved Drizzle tenant migration runner (never during API startup).

CREATE TABLE "crm_organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"cnpj" text,
	"email" text,
	"phone" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_organizations_name_check" CHECK ("name" <> '' AND char_length("name") <= 200),
	CONSTRAINT "crm_organizations_email_check" CHECK ("email" IS NULL OR ("email" <> '' AND char_length("email") <= 320 AND "email" ~ '.+@.+[a-z]')),
	CONSTRAINT "crm_organizations_phone_check" CHECK ("phone" IS NULL OR ("phone" <> '' AND char_length("phone") <= 32)),
	CONSTRAINT "crm_organizations_cnpj_check" CHECK ("cnpj" IS NULL OR ("cnpj" <> '' AND char_length("cnpj") <= 20))
);
CREATE UNIQUE INDEX "crm_organizations_cnpj_unique" ON "crm_organizations" ("cnpj") WHERE "cnpj" IS NOT NULL;
CREATE INDEX "crm_organizations_name_idx" ON "crm_organizations" USING btree ("name");

CREATE TABLE "crm_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"cpf" text,
	"email" text,
	"phone" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_people_full_name_check" CHECK ("full_name" <> '' AND char_length("full_name") <= 200),
	CONSTRAINT "crm_people_email_check" CHECK ("email" IS NULL OR ("email" <> '' AND char_length("email") <= 320 AND "email" ~ '.+@.+[a-z]')),
	CONSTRAINT "crm_people_phone_check" CHECK ("phone" IS NULL OR ("phone" <> '' AND char_length("phone") <= 32)),
	CONSTRAINT "crm_people_cpf_check" CHECK ("cpf" IS NULL OR ("cpf" <> '' AND char_length("cpf") <= 20))
);
CREATE UNIQUE INDEX "crm_people_cpf_unique" ON "crm_people" ("cpf") WHERE "cpf" IS NOT NULL;
CREATE INDEX "crm_people_full_name_idx" ON "crm_people" USING btree ("full_name");

CREATE TABLE "crm_relationships" (
	"person_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" text DEFAULT 'contact' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_relationships_person_org_pk" PRIMARY KEY("person_id", "organization_id"),
	CONSTRAINT "crm_relationships_person_fk" FOREIGN KEY ("person_id") REFERENCES "public"."crm_people"("id"),
	CONSTRAINT "crm_relationships_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."crm_organizations"("id"),
	CONSTRAINT "crm_relationships_role_check" CHECK ("role" IN ('contact'))
);
CREATE INDEX "crm_relationships_organization_idx" ON "crm_relationships" USING btree ("organization_id");
CREATE INDEX "crm_relationships_person_idx" ON "crm_relationships" USING btree ("person_id");

CREATE TABLE "crm_employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"control_plane_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_employees_display_name_check" CHECK ("display_name" <> '' AND char_length("display_name") <= 200)
);
CREATE UNIQUE INDEX "crm_employees_actor_unique" ON "crm_employees" ("control_plane_actor_id") WHERE "control_plane_actor_id" IS NOT NULL;
