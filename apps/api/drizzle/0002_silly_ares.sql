CREATE TYPE "public"."discovery_source" AS ENUM('DIRECT', 'WEB');--> statement-breakpoint
CREATE TYPE "public"."parse_method" AS ENUM('ATS_API', 'HTML', 'LLM_FALLBACK');--> statement-breakpoint
CREATE TABLE "domain_configs" (
	"domain" varchar(255) PRIMARY KEY NOT NULL,
	"job_link_selector" text,
	"next_page_selector" text,
	"last_validated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "discovery_source" "discovery_source" DEFAULT 'DIRECT' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "hero_image_url" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "root_domain" varchar(255);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "quality_score" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "parse_method" "parse_method" DEFAULT 'HTML' NOT NULL;