CREATE TYPE "public"."provisioning_state" AS ENUM('pending', 'in_progress', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"database_name" text NOT NULL,
	"provisioning_state" "provisioning_state" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_database_name_unique" UNIQUE("database_name")
);
