ALTER TABLE "applications" ADD COLUMN "interviewing_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "offer_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "ghosted_at" timestamp with time zone;