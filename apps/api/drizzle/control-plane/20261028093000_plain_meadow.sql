CREATE TABLE "tenant_provisioning" (
	"tenant_id" uuid NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"stage" text NOT NULL,
	"failure_code" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "tenant_provisioning_tenant_id_pk" PRIMARY KEY("tenant_id"),
	CONSTRAINT "tenant_provisioning_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
);
