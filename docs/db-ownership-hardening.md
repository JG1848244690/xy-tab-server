# 用户归属与数据安全加固设计

状态:**待实施** · 涉及 `src/**`、生产 DB · 触发后端 CI 重建重启

## 0. 现状审计(2026-10-16)

### 0.1 好的方面(保持不动)
| 项 | 现状 |
|---|---|
| todos / stats / attempts 读写隔离 | 所有 handler 均按 `c.get('userId')` 过滤,无越权读 |
| `todos.user_id` | `NOT NULL`,handler 注入,客户端不可传 |
| Cookie | `HttpOnly` + 生产 `secure` + `SameSite=Lax` |
| JWT | HS256,`JWT_SECRET` 必填(min 16,无兜底默认值),有效期 1 天 |
| 密码 | bcrypt cost 10(与存量 hash 兼容) |

### 0.2 发现的问题
| # | 问题 | 严重度 |
|---|---|---|
| P1 | **全库 0 条外键约束**。`questions.created_by`、`question_stats.user_id/question_id`、`question_attempts.user_id/question_id`、`todos.user_id` 全是裸 uuid。删用户/删题→孤儿数据静默产生(昨天手工迁移删 `admin@123.com` 时全靠 SQL 兜) | 高 |
| P2 | **`questions.created_by` 可空 + 权限不对称**:无主题"人人可删、无人可改";且列表/详情/作答完全不校验归属——共享题库,任何登录用户可读所有人的题(含答案)并对任意题作答 | 高(多用户场景) |
| P3 | `app.ts` 走 Hono 默认 `cors()` → `Access-Control-Allow-Origin: *`;同源 SPA 已不需要 CORS,全开属于多余攻击面 | 中 |
| P4 | `/auth/login`、`/auth/register` 无任何限流;邮箱不存在时直接 401(与密码错误路径耗时不同,可探测账号是否存在) | 中 |
| P5 | 注册密码仅 `min(6)`;注册接口对全网开放、无开关 | 中 |
| P6 | `getStats` 的 `total` 统计的是**全表**题目数,不是当前用户的 | 低 |
| P7 | `questions.created_by` 无索引——P2 改为 owner 过滤后列表查询需要它 | 低 |

## 1. 目标

1. **数据库级完整性**:孤儿数据在 DB 层不可能产生(而非靠 handler 记得手工清)。
2. **多用户数据隔离**:题目归属明确,读/写/删全部校验 ownership。
3. **入口防护**:限流、CORS 收紧、注册可控。
4. **存量数据无损同步**:等幂修复脚本 + 部署后验证,可安全回滚。

## 2. 数据模型变更(migration 0001)

### 2.1 约束清单

| 表.列 | 变更 | ON DELETE | 理由 |
|---|---|---|---|
| `questions.created_by` | `NOT NULL` + FK → `users.id` + 新增索引 | `CASCADE`(**决策 D2**) | 删号连带删掉其名下全部题目(含 共享 题),练习数据经 question_id 级联一并清理 |
| `questions.visibility`(**新增列**) | `pgEnum('question_visibility')` `['shared','private']`,默认 `'shared'`,`NOT NULL` | — | **决策 D1**:题目可见性可配置;创建默认共享,可选私有 |
| `question_stats.user_id` | FK → `users.id` | `CASCADE` | 删用户→该用户练习状态随之清理,与现有手工流程一致 |
| `question_stats.question_id` | FK → `questions.id` | `CASCADE` | 删题→练习状态清理(现有 `remove` handler 正是手工做这件事,FK 后可简化) |
| `question_attempts.user_id` | FK → `users.id` | `CASCADE` | 同上 |
| `question_attempts.question_id` | FK → `questions.id` | `CASCADE` | 同上 |
| `todos.user_id` | FK → `users.id` | `CASCADE` | 同上 |
| `questions` 新增索引 | `questions_created_by_idx` | — | 支撑 owner 过滤列表查询 |

> 为什么不把 `question_id` 设 RESTRICT:题目是私有内容(见 §4),owner 删自己的题时,他名下的统计/明细跟着消失是合理语义,且免掉 handler 里的手工两连删。

### 2.2 实现方式
- 修改 `src/db/schema.ts`:加 `.references(() => users.id, { onDelete: 'cascade', ... })` / `notNull()`,跑 `pnpm db:generate` 生成迁移,人工审 SQL。
- 生成的 SQL 改写为两段式:`ADD CONSTRAINT ... NOT VALID` → `VALIDATE CONSTRAINT`(先加锁校验引用,再全表校验,锁时间最短;80 行的表都属于惯例操作)。
- 容器启动时自动执行(`src/index.ts` 的 `migrate()`),无需额外部署步骤。
- **向后兼容**:旧镜像跑在新 schema 上不受影响(所有写入路径本来就带 `userId`/`createdBy`;旧 `remove` 的手工删除也兼容)。回滚 = 回滚镜像即可,约束无需回退。

## 3. 存量数据同步(运维 runbook,部署窗口执行)

修复脚本(等幂、可重复跑),顺序:

```sql
-- 1) 删孤儿:引用了不存在用户/题目的行(当前生产全为 0,脚本为保险兜底)
DELETE FROM question_stats    s WHERE NOT EXISTS (SELECT 1 FROM users u      WHERE u.id = s.user_id)
                              OR NOT EXISTS (SELECT 1 FROM questions q WHERE q.id = s.question_id);
DELETE FROM question_attempts a WHERE NOT EXISTS (SELECT 1 FROM users u      WHERE u.id = a.user_id)
                              OR NOT EXISTS (SELECT 1 FROM questions q WHERE q.id = a.question_id);
DELETE FROM todos             t WHERE NOT EXISTS (SELECT 1 FROM users u      WHERE u.id = t.user_id);

-- 2) 无主题目归属:【不静默猜测】
--    策略:无主题为 0 时跳过;>0 时人工确认归属后执行
--    UPDATE questions SET created_by = '<目标用户uuid>' WHERE created_by IS NULL;
--    (当前生产 = 0 行,实际 no-op;规则写入 runbook 保证以后导旧数据也安全)

-- 3) 验证(应全部为 0 + 约束存在清单)
--    · 孤儿计数 ×5 组 == 0
--    · pg_constraint 中 6 条 FK 存在
--    · created_by IS NULL 计数 == 0
```

执行时机:镜像部署后(启动即自动迁移)→ 立即跑修复 SQL → 验证 SQL → 冒烟(登录 / 题库列表 / 答题 / 统计)。若迁移在启动阶段因脏数据失败,容器不健康,**回滚镜像 + 回放反向 SQL(备好 DROP CONSTRAINT 脚本)**。

## 4. 应用层:questions 模块隔离

可见性规则:**shared = 所有登录用户可见可练;private = 仅 owner 可见可练**;编辑/删除一律 owner-only。统一使用判定 `visible = visibility='shared' OR created_by=userId`。

| Handler | 现状 | 变更后 |
|---|---|---|
| `list` | 全表扫,不按 owner/可见性过滤 | 追加 `visible` 条件(决策 D1) |
| `getOne` | 任何登录用户可读任意题(含答案) | 非 shared 且非 owner → 404(不泄露"存在但不是你的") |
| `update` | 已按 owner 过滤 | 不变(create/update body 新增 `visibility` 字段,owner 可切换) |
| `remove` | 无主题人人可删;手工两连删 stats/attempts | owner-only + FK CASCADE 兜底;宽容逻辑删除 |
| `submit` | 可对任意题作答 | 非 shared 且非 owner → 404 |
| `markCorrect` / `getAttempts` | 已按 userId+questionId+attemptId 校验 | 不变 |
| stats 模块 | 部分接口扫全表(dashboard recentAdded / 本周新增 / tag 饼图 / difficulty 饼图 / incomplete 列表 / recent-added 列表) | 全部追加 `visible` 条件;`getStats` 的 `total` 同样按可见题数计(P6) |

> 迁移 0001 里 `created_by SET NOT NULL` 使"无主题"分支从此消失。

**并发硬化(P8)**:`submit` 的 stats upsert 把 `totalAttempts: prevAttempts + 1` 改成 SQL 侧自增 `${questionStats.totalAttempts} + 1`,避免两个会话并发作答时用相同旧值互相覆盖(丢计数)。

## 5. 入口防护

| 项 | 方案 |
|---|---|
| 登录/注册限流 | 新增 `src/middlewares/rate-limit.ts`:固定窗口按 IP 计数(内存 Map,单容器足够;多实例时再换 Redis)。`/auth/login`、`/auth/register` 各 30 req/min,超限 429 |
| 登录时序对齐 | 邮箱不存在时也执行一次 dummy bcrypt compare,使两种失败路径耗时不可区分(P4) |
| CORS | 生产只放行 env `CORS_ORIGINS` 白名单(`https://hls.kskbl.com.cn` 等),dev 保持宽松;同源 SPA 实际只依赖自家 origin(P3) |
| 注册开关 | env `REGISTRATION_ENABLED`(默认 `true`),需要时改服务器 `.env` 一行即可关闭注册(P5) |
| 密码策略 | `min(6)` → `min(8)`,只影响新注册,存量 hash 不动 |
| 用户名唯一 | 不加硬约束:登录只认 email,`username` 仅展示名;避免误伤存量重名 |

## 6. 测试与验收

1. `pnpm typecheck && pnpm lint && pnpm test`(vitest;补充拒绝路径用例:B 读 A 的题 → 404,C 删别人的题 → 404,未创建 stats 的题首次判对仍成立)。
2. 本地两账号交叉验证(SH 隧道连生产 API 时注意——交叉验证只对本地 DB 跑)。
3. 生产部署后:§3.3 验证 SQL + 冒烟(omen 登录、题库、答一题、统计图表)。

## 7. 风险与回滚

| 风险 | 缓解 |
|---|---|
| 迁移遇脏数据启动失败 | §3 的等幂修复 + 备好 DROP CONSTRAINT 反向脚本;回滚镜像 |
| 鷨库可见性改变(如果选私有) | 生产仅 omen 一个真实用户、81 题全归 omen → 无感;多账号时各自看各自的 |
| FK 导致旧导入脚本失败 | `scripts/migrate-mysql-to-pg.ts` 本就先插 users 再插内容,顺序已满足;再跑一次前需复核 |

## 8. 决策记录

| # | 决策 | 结论(2026-10-16 用户拍板) |
|---|---|---|
| D1 | 题库可见性 | 新增 `visibility` 字段:**创建默认共享,可选私有;存量数据跑脚本全部置为共享,但必须保留归属(created_by 迁移为 NOT NULL,源头可追溯)** |
| D2 | `questions.created_by` 删号语义 | **CASCADE** —— 删号连带其名下全部题目(含共享题)与练习数据 |

## 9. 前端配套(web/)

- `Question` / `CreateQuestionDto` 类型加 `visibility`。
- 出题/编辑表单加「共享 / 私有」选择(默认共享)。
- 列表行对私有题显示「私有」标记。
- 后端先上(旧前端对新增字段无感);前端随后单独发版(web.yml 自动部署)。
