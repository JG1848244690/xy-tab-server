-- pgvector 扩展:embedding 列与 HNSW 索引依赖它。
-- 生产/测试 PG 镜像必须是 pgvector/pgvector:pg17(compose 已同步),
-- 官方 postgres:17-alpine 没有这个扩展,扩展缺失时本迁移会失败
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."article_kind" AS ENUM('own', 'curated');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('draft', 'pending_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"cover" varchar(500),
	"kind" "article_kind" DEFAULT 'own' NOT NULL,
	"content_md" text,
	"external_url" varchar(1000),
	"source_domain" varchar(255),
	"comment" text,
	"excerpt" text,
	"related_question_ids" jsonb,
	"tags" jsonb,
	"status" "review_status" DEFAULT 'draft' NOT NULL,
	"review_score" integer,
	"review_result" jsonb,
	"content_hash" varchar(64),
	"published_at" timestamp,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"cover" varchar(500),
	"tags" jsonb,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawl_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'running' NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "review_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"content_hash" varchar(64),
	"verdict" "review_status" NOT NULL,
	"score" integer,
	"report" jsonb,
	"model" varchar(100),
	"latency_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"kind" varchar(50) NOT NULL,
	"url" varchar(1000),
	"enabled" boolean DEFAULT true NOT NULL,
	"robots_checked_at" timestamp,
	"robots_allowed" boolean,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staging_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"source_id" uuid,
	"raw_title" text,
	"raw_url" varchar(1000),
	"fingerprint" varchar(128),
	"payload" jsonb,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(255) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "status" "review_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "review_score" integer;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "review_result" jsonb;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "content_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "slug" varchar(255);--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "view_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "bank_id" uuid;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banks" ADD CONSTRAINT "banks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawl_runs" ADD CONSTRAINT "crawl_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staging_questions" ADD CONSTRAINT "staging_questions_run_id_crawl_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."crawl_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staging_questions" ADD CONSTRAINT "staging_questions_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "articles_slug_idx" ON "articles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "articles_status_published_idx" ON "articles" USING btree ("status","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "banks_slug_idx" ON "banks" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "review_logs_question_idx" ON "review_logs" USING btree ("question_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_key_idx" ON "sources" USING btree ("key");--> statement-breakpoint
CREATE INDEX "staging_questions_status_idx" ON "staging_questions" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_registry_slug_idx" ON "tag_registry" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "questions_slug_idx" ON "questions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "questions_status_published_idx" ON "questions" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "questions_embedding_idx" ON "questions" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
-- ============================================================
-- 存量 81 题清洗(面试站 MVP 验收标准:全部有 slug/审核状态)
-- 此迁移执行时所有 questions 行都是存量(新列默认 draft):
-- 置 approved + 给兜底 slug(q-<md5(id) 前 12 位>),published_at 落当前时间。
-- slug 由 agent 清洗时再美化成标题拼音/英文;唯一索引兜底不冲突。
-- 后续用户新建的题默认 draft,不会命中本 UPDATE(且带 slug IS NULL 守卫,
-- 本语句天然幂等,重放也无害)
-- ============================================================
UPDATE "questions"
SET "status" = 'approved',
    "slug" = 'q-' || left(md5("id"::text), 12),
    "published_at" = COALESCE("published_at", now())
WHERE "slug" IS NULL
  AND "status" = 'draft';