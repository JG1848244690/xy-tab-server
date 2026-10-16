-- ============================================================
-- 归属/约束 验证脚本
-- 用法:docker exec -i hls-api-postgres-1 psql -U postgres -d hlse < ownership-verify.sql
-- 预期:孤儿计数全为 0;created_by NULL 为 0;FK 清单 6 条全部存在
-- ============================================================

\echo '== 1. 孤儿数据(应全为 0)=='
SELECT 'stats->missing_user'     AS check, count(*) FROM question_stats    s WHERE NOT EXISTS (SELECT 1 FROM users     u WHERE u.id = s.user_id)
UNION ALL SELECT 'stats->missing_question',    count(*) FROM question_stats    s WHERE NOT EXISTS (SELECT 1 FROM questions q WHERE q.id = s.question_id)
UNION ALL SELECT 'attempts->missing_user',     count(*) FROM question_attempts a WHERE NOT EXISTS (SELECT 1 FROM users     u WHERE u.id = a.user_id)
UNION ALL SELECT 'attempts->missing_question', count(*) FROM question_attempts a WHERE NOT EXISTS (SELECT 1 FROM questions q WHERE q.id = a.question_id)
UNION ALL SELECT 'todos->missing_user',        count(*) FROM todos             t WHERE NOT EXISTS (SELECT 1 FROM users     u WHERE u.id = t.user_id);

\echo '== 2. created_by IS NULL(应为 0)=='
SELECT count(*) AS ownerless_questions FROM questions WHERE created_by IS NULL;

\echo '== 3. 外键约束清单(应 6 条)=='
SELECT conrelid::regclass AS tbl, conname, pg_get_constraintdef(oid)
  FROM pg_constraint
 WHERE contype = 'f'
 ORDER BY 1, 2;

\echo '== 4. visibility 分布(默认 shared)=='
SELECT visibility, count(*) FROM questions GROUP BY visibility ORDER BY 2 DESC;

\echo '== 5. 题目归属分布 =='
SELECT COALESCE(u.email, '(none)') AS owner, count(*)
  FROM questions q LEFT JOIN users u ON u.id = q.created_by
 GROUP BY 1 ORDER BY 2 DESC;
