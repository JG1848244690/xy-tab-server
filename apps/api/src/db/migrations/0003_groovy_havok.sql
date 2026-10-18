CREATE TABLE "question_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"day" date NOT NULL,
	"ip_hash" varchar(32) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "question_views" ADD CONSTRAINT "question_views_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "question_views_dedup_idx" ON "question_views" USING btree ("question_id","day","ip_hash");--> statement-breakpoint
CREATE INDEX "question_views_day_idx" ON "question_views" USING btree ("day");