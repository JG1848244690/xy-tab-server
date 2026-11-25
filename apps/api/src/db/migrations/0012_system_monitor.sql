CREATE TABLE "system_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"target_id" uuid,
	"action" varchar(32) NOT NULL,
	"status" integer NOT NULL,
	"source" varchar(16),
	"request_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "system_events_date_idx" ON "system_events" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "system_events_actor_date_idx" ON "system_events" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "system_events_action_date_idx" ON "system_events" USING btree ("action","created_at");