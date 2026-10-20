CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
ALTER TYPE "public"."review_status" ADD VALUE 'human_pending' BEFORE 'approved';--> statement-breakpoint
ALTER TABLE "review_logs" ADD COLUMN "source" varchar(10) DEFAULT 'ai' NOT NULL;--> statement-breakpoint
ALTER TABLE "review_logs" ADD COLUMN "reviewer_id" uuid;--> statement-breakpoint
ALTER TABLE "review_logs" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_logs_created_idx" ON "review_logs" USING btree ("created_at");--> statement-breakpoint
-- ============================================================
-- 存量回填:谁是 admin?
-- 规则:最早注册的账号(迁移进来的原主账号)+ omen@123.com(当前使用账号)
-- 其余一律 user。以后在后台加人/改角色直接 UPDATE users SET role='admin'
-- ============================================================
UPDATE "users"
SET "role" = 'admin'
WHERE "email" = 'omen@123.com'
   OR "id" = (SELECT id FROM "users" ORDER BY "created_at" ASC LIMIT 1);