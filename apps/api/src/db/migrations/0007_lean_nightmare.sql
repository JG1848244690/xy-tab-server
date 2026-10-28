ALTER TABLE "questions" ADD COLUMN "direction" varchar(32);--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "tech_stack" varchar(64);--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "knowledge_points" jsonb;--> statement-breakpoint
ALTER TABLE "tag_registry" ADD COLUMN "kind" varchar(16) DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
CREATE INDEX "questions_direction_idx" ON "questions" USING btree ("direction");--> statement-breakpoint
CREATE INDEX "questions_tech_stack_idx" ON "questions" USING btree ("tech_stack");--> statement-breakpoint
CREATE INDEX "questions_points_idx" ON "questions" USING gin ("knowledge_points");