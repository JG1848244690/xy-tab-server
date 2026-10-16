-- ============================================================
-- 迁移 0001 外键回滚脚本(应急用:迁移失败需回滚镜像时,先降级 schema)
-- 用法:docker exec -i hls-api-postgres-1 psql -U postgres -d hlse < fk-rollback.sql
-- 注意:仅移除约束与新列,不动数据;visibility 删除后旧镜像照常运行
-- ============================================================

ALTER TABLE "question_attempts" DROP CONSTRAINT IF EXISTS "question_attempts_user_id_users_id_fk";
ALTER TABLE "question_attempts" DROP CONSTRAINT IF EXISTS "question_attempts_question_id_questions_id_fk";
ALTER TABLE "question_stats"    DROP CONSTRAINT IF EXISTS "question_stats_user_id_users_id_fk";
ALTER TABLE "question_stats"    DROP CONSTRAINT IF EXISTS "question_stats_question_id_questions_id_fk";
ALTER TABLE "questions"         DROP CONSTRAINT IF EXISTS "questions_created_by_users_id_fk";
ALTER TABLE "todos"             DROP CONSTRAINT IF EXISTS "todos_user_id_users_id_fk";
DROP INDEX IF EXISTS "questions_created_by_idx";
ALTER TABLE "questions" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE "questions" DROP COLUMN IF EXISTS "visibility";
DROP TYPE IF EXISTS "question_visibility";
