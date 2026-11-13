ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp;
--> statement-breakpoint
-- 历史账号豁免:邮箱验证是新规则,不该追溯惩罚已有账号
-- (否则现有 2 个账号一登录就顶着「未验证」提示,又收不到补发的信)
UPDATE "users" SET "email_verified_at" = now() WHERE "email_verified_at" IS NULL;
