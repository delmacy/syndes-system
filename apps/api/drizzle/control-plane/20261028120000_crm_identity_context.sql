CREATE TABLE "identity_actors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issuer" text NOT NULL,
	"subject" text NOT NULL,
	"platform_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identity_actors_issuer_subject_unique" UNIQUE("issuer", "subject")
);

CREATE TABLE "tenant_domains" (
	"hostname" text PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_domains_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id"),
	CONSTRAINT "tenant_domains_status_check" CHECK ("status" IN ('active', 'disabled')),
	CONSTRAINT "tenant_domains_hostname_normalized_check" CHECK ("hostname" = lower("hostname") AND "hostname" !~ '[[:space:]/\\]')
);

CREATE TABLE "tenant_memberships" (
	"tenant_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"role" text NOT NULL,
	"customer_scope" text DEFAULT 'both' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_memberships_tenant_actor_pk" PRIMARY KEY("tenant_id", "actor_id"),
	CONSTRAINT "tenant_memberships_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id"),
	CONSTRAINT "tenant_memberships_actor_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."identity_actors"("id"),
	CONSTRAINT "tenant_memberships_role_check" CHECK ("role" IN ('tenant_admin', 'tenant_member')),
	CONSTRAINT "tenant_memberships_scope_check" CHECK ("customer_scope" IN ('cpf', 'pj', 'both')),
	CONSTRAINT "tenant_memberships_status_check" CHECK ("status" IN ('active', 'revoked')),
	CONSTRAINT "tenant_memberships_admin_scope_check" CHECK ("role" <> 'tenant_admin' OR "customer_scope" = 'both')
);
CREATE INDEX "tenant_memberships_actor_status_idx" ON "tenant_memberships" USING btree ("actor_id", "status");

CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"actor_id" uuid,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"result" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id"),
	CONSTRAINT "audit_events_actor_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."identity_actors"("id"),
	CONSTRAINT "audit_events_result_check" CHECK ("result" IN ('success', 'denied', 'failure'))
);
CREATE INDEX "audit_events_tenant_time_idx" ON "audit_events" USING btree ("tenant_id", "occurred_at");
