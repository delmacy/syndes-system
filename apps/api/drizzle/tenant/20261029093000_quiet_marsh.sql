CREATE TABLE "tenant_baseline_info" (
	"baseline_version" text NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_baseline_info_row_pk" PRIMARY KEY("baseline_version")
);
