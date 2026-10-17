CREATE TYPE "public"."difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."question_status" AS ENUM('not_started', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('markdown', 'text');--> statement-breakpoint
CREATE TABLE "question_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"user_answer" text,
	"is_correct" boolean DEFAULT false NOT NULL,
	"time_spent" integer,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_stats" (
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"total_attempts" integer DEFAULT 0 NOT NULL,
	"correct_attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp,
	"first_correct_at" timestamp,
	"best_time" integer,
	"status" "question_status" DEFAULT 'not_started' NOT NULL,
	CONSTRAINT "question_stats_user_id_question_id_pk" PRIMARY KEY("user_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"type" "question_type" DEFAULT 'text' NOT NULL,
	"content" text NOT NULL,
	"answer" text NOT NULL,
	"difficulty" "difficulty" DEFAULT 'medium' NOT NULL,
	"tags" jsonb,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "todos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"start_time" varchar(8) DEFAULT '00:00' NOT NULL,
	"end_time" varchar(8) DEFAULT '23:59' NOT NULL,
	"content" text NOT NULL,
	"color" varchar(20) DEFAULT '#00a76f' NOT NULL,
	"description" text,
	"all_day" boolean DEFAULT false NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"username" varchar(100),
	"avatar_path" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "question_attempts_user_question_idx" ON "question_attempts" USING btree ("user_id","question_id","created_at");--> statement-breakpoint
CREATE INDEX "question_attempts_user_created_idx" ON "question_attempts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "question_stats_user_status_idx" ON "question_stats" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "question_stats_user_first_correct_idx" ON "question_stats" USING btree ("user_id","first_correct_at");--> statement-breakpoint
CREATE INDEX "questions_created_at_idx" ON "questions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "questions_tags_idx" ON "questions" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "todos_user_start_date_idx" ON "todos" USING btree ("user_id","start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");