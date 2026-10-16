-- ============================================================
-- 归属数据修复脚本(等幂,可重复执行)
-- docs/db-ownership-hardening.md §3
--
-- 时机:部署新镜像之后跑(容器启动时迁移 0001 会自动执行;
--       created_by SET NOT NULL 要求库里无"无主题",本脚本先保证这一点)
-- 用法:docker exec -i hls-api-postgres-1 psql -U postgres -d hlse < ownership-repair.sql
-- ============================================================

-- 1) 清孤儿:引用了不存在用户/题目的行
DELETE FROM question_stats    s
 WHERE NOT EXISTS (SELECT 1 FROM users      u WHERE u.id = s.user_id)
    OR NOT EXISTS (SELECT 1 FROM questions  q WHERE q.id = s.question_id);

DELETE FROM question_attempts a
 WHERE NOT EXISTS (SELECT 1 FROM users      u WHERE u.id = a.user_id)
    OR NOT EXISTS (SELECT 1 FROM questions  q WHERE q.id = a.question_id);

DELETE FROM todos             t
 WHERE NOT EXISTS (SELECT 1 FROM users      u WHERE u.id = t.user_id);

-- 2) 无主题目归属 —— 不静默猜测。
--    当前生产应为 0 行(81 题已全部归属 omen@123.com)。
--    若下方检查查出无主题,由运维人工确认目标用户后执行:
--      UPDATE questions SET created_by = '<目标用户uuid>'
--       WHERE created_by IS NULL
--         AND id IN (...);   -- 或全部

-- 3) 旧版"人人可删的无主题"历史遗留清理:无(逻辑已随迁移删除)
