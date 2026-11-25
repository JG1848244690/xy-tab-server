CREATE TABLE "learning_days" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	CONSTRAINT "learning_days_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE TABLE "learning_leaderboard_members" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"alias_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"enabled" boolean NOT NULL
);
--> statement-breakpoint
ALTER TABLE "question_stats" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "learning_days" ADD CONSTRAINT "learning_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_leaderboard_members" ADD CONSTRAINT "learning_leaderboard_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "learning_days_day_user_idx" ON "learning_days" USING btree ("day","user_id");