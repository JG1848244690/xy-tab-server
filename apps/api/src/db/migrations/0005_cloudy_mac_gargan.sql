CREATE TABLE "ai_quota" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_quota_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "created_ip_hash" varchar(32);--> statement-breakpoint
ALTER TABLE "ai_quota" ADD CONSTRAINT "ai_quota_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_created_ip_hash_idx" ON "users" USING btree ("created_ip_hash","created_at");