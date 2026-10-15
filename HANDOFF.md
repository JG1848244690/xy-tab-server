# hlsEdu 后端交接文档

> 写于 2026-10-11,hls-api 分支。本文档只讲**状态和待办**;
> 接口清单、环境变量、部署方式以 [README.md](./README.md) 为准,不在此重复。

## 项目背景

把旧后端(NestJS 11 + TypeORM + MySQL `hls_edu`)重写成 Hono + Drizzle + PostgreSQL,
因为要部署到配置吃紧的服务器。仓库本身是从原来的 Tasks/DeepAgent 后端
(`pgsql` 分支)改造成的,那些遗留物已全部删除。

前端**不在本仓库**,在 `C:\Users\xy\Desktop\hlsEdu\web-front`,也没进 git。

## 当前进度

### 已完成

- 4 个模块全部写完并跑通:`auth` / `questions` / `stats` / `todos`
  (视频模块 `videos` / `collections` / `learning_progress` **已从范围里砍掉**,新 schema 无对应表)
- 数据库从零建起:`.env` → Postgres 容器 → 生成迁移 → 应用,schema / enum / 索引都已核对
- 旧 deepagent 残留(tasks / sync_* / agent / google-jwks / fetch-google-jwks.ts)全部删除
- 启动时自动迁移的表名漂移 bug 已修(见下方"踩过的坑")
- 单元测试 9 个(auth 模块);`tsc --noEmit`、`pnpm build` 全绿
- 端到端 20 项手工检查全过,外加一轮边界检查(多用户隔离、跨用户写入/删除/判分返回 404、
  `ON CONFLICT` 累加、`bestTime` 取 min、跨天 todo、401 未登录/伪造 token、422 非法 uuid)
- CI 重写:全分支构建镜像推到 GHCR,仅 push `hls-api` 时自动部署到服务器
- **服务器容器化部署已打通并验证**(2026-10-15):`/opt/hls-api` 已建好,和老的
  `/opt/tasks-api` 同机并存,nginx 走 `kskbl.com.cn/api-hls` 子路径。细节见下节。
- **存量数据已导入生产 PG**(2026-10-15):从**开发机本机** MySQL `hls_edu`
  导入 users 4 / questions 81 / question_stats 57 / question_attempts 100 / todos 102。
  迁移脚本双重编码 jsonb 的 bug 已修(见"踩过的坑 · 7"),导入后全套读接口用
  真实数据复验通过。

## 服务器部署现状(已跑通)

机器 `root@47.94.85.91`(阿里云,宝塔面板),内存只有 1.6G,已跑 4 个容器。

| | 老服务 | 本服务 |
|---|---|---|
| 目录(= compose 项目名) | `/opt/tasks-api` | `/opt/hls-api` |
| 镜像 | `ghcr.io/jg1848244690/xy-tab-server` | `ghcr.io/jg1848244690/hls-api` |
| app 宿主端口 | 9999 | **4000** |
| PG 宿主端口 | 5433 | **5434** |
| 对外路径 | `/api` | **`/api-hls`** |
| DB / 卷 | `tasks` / `tasks-pg-data` | `hlse` / `hlse-pg-data` |

- `/opt/hls-api` 的 clone:remote 名 **`github`**(`git@github.com:JG1848244690/xy-tab-server.git`),
  和 CI 里的 `DEPLOY_REMOTE` 一致;CI 里 `IMAGE_TAG` 用**完整 40 位 SHA**。
- `/opt/hls-api/.env`(不进 git):`PORT=4000` / `PG_HOST_PORT=5434` /
  `OPENAPI_BASE_PATH=/api-hls` / `JWT_SECRET=<随机>`。
- nginx 走宝塔的 extension 钩子,**没动** `html_kskbl.com.cn.conf` 本体:
  仓库 `deploy/nginx/kskbl.com.cn-api-hls.conf` → 装到
  `/www/server/panel/vhost/nginx/extension/kskbl.com.cn/hls-api.conf`。
- 验证过:容器 healthy、启动迁移干净通过(`hlse_migrations` 有 1 条记录,没重放)、
  经 nginx 的注册 → 登录(HttpOnly cookie)→ `/auth/me`(带 `name`)→
  `/stats/dashboard`(带 `videos` 对象)全通;老服务的 `/api` 与 9999 未受影响。

### 本次修掉的坑(都写进 README 了)

- **`IMAGE_TAG` 用了 `git rev-parse --short HEAD`(7 位),而 CI 推的 tag 是完整 40 位
  `${{ github.sha }}`** —— 永远匹配不上,`docker compose pull` 直接找不到镜像。
  改成 `git rev-parse HEAD`。
- 端口撞车:app 默认 9999、PG 默认 5433,都被 tasks-api 占了。把 PG 端口也做成
  `${PG_HOST_PORT:-5433}`(默认值不变,本地开发不受影响),服务器 `.env` 里覆盖。

## 未完成(下次接着做)

1. **前端**:说要重写成 SPA 以省服务器资源,还没动。重写时前端请求直接打到
   `/api-hls`(nginx 已配好),不再是 `next.config.ts` 里的 rewrite →
   `localhost:4000`。`localhost:4000` 现在**确实**是本服务(app 容器宿主端口),
   但 SPA 走 nginx 子路径更省一层。
2. **没有监控/告警**,也没有 `:latest` 回滚演练。回滚方式:改 `/opt/hls-api/.env`
   或直接 `IMAGE_TAG=<旧sha> docker compose up -d`。
3. **老库还有几个功能没迁**(本轮范围外,新 schema 没有对应列):
   `questions.average_time/total_attempts/total_correct/global_correct_rate`、
   `question_stats.consecutive_correct/consecutive_wrong/mastery_level/next_review_at`、
   `question_attempts.difficulty_at_attempt/user_ability_at_attempt/from_recommendation`。
   还有 3 张表完全没迁:`recommendation_logs`(1095 行)/`tag_relations`(17)/
   `learning_curve_snapshots`(0)/`user_learning_preferences`(0)。要做就得先扩 schema。

## 迁移脚本:先 dry-run,已验证

```bash
pnpm db:import --dry-run    # 只读,不写库
pnpm db:import              # 实际导入(单事务,失败整体回滚)
pnpm db:import --truncate   # 重跑时用,先清空目标表
```

源库密码走交互式询问(不回显),或 `MYSQL_PASSWORD` 环境变量。**不要**写进命令行或文件。

**2026-10-15 已在真实数据上跑通**(本机 MySQL → 服务器 PG,经 SSH 隧道):

- **主键映射**:4/81/100 个 id **全是合法 uuid**,`需重映射` 全为 0 —— 那条"生成新 uuid
  并改写全部外键"的分支实测走空,所以**它至今仍未在真实数据上验证过**。哪天遇到非 uuid
  的旧 id,还得重新看一遍。
- **中文标签**:`算法` / `Promise` / `双指针` 等 25 个标签,jsonb 里完好,没有 U+FFFD 乱码。
- **孤儿行**:0 条被丢弃(源库计数与导入计数逐表相等)。
- **6 条题目的 `tags` 是 SQL NULL**(源库就是 NULL),按原样保留,没有补成 `[]`。

## 踩过的坑(别再踩)

**1. 迁移表名漂移 —— 会直接炸生产**
`drizzle-kit migrate` 把"已应用"记进 `public.hlse_migrations`,
而 `migrate()` 不传参数时默认去 `drizzle.__drizzle_migrations` 找 —— 查不到空表
→ 认为所有迁移都没跑过 → 重放整批 SQL → `42710`(CREATE TYPE 已存在)启动失败。
现在三个常量(`MIGRATIONS_TABLE` / `MIGRATIONS_SCHEMA` / `MIGRATIONS_FOLDER`)都集中在
`src/db/migrations-table.ts`,由 `drizzle.config.ts` 和 `src/index.ts` **共用同一个常量**,不会漂移。

**2. PG 和 MySQL 的 SQL 语义差异**(每个都真的报错过)
- 表一旦被 `AS alias`,**同一 FROM 子句里原表名就不可见了**(MySQL 允许,PG 不允许,报 `42P01`)。
  `questions.handlers.ts` 里 join 别名后,where / ON / select 必须全用别名。
- `timestamp` 列不能 `coalesce(col, 0)`,改用 `order by col desc nulls last`。
- 非聚合的 select 表达式必须原样出现在 `group by` 里,否则 `42803`。
  `to_char(...)` 要把 `date_trunc(...)` 一起包进去,两边完全一致。
- 裸子查询当 `FROM` 用会 `42601`,必须包成派生表并起别名。

**3. drizzle 的 `sql` 模板不做类型映射**
`sql\`coalesce(${col}, ${someDate})\`` 里绑 JS `Date` 会被 postgres.js `toString()` 成
`"Sun Oct 11 2026 ..."` 而不是 ISO,PG 解析不了 → 500。
`values()` 内部会做映射,`sql` 模板不会。日期一律 `.toISOString()`。

**4. 测试会被 dist 扫两遍**
`dist/**/*.test.js` 被 vitest 再扫一次 → 9 个用例跑成 18 个。
已用 `tsconfig.json` 的 `exclude` + `vitest.config.ts` 解决。

**5. Windows 上 `pkill -f` 杀不掉 node**
用 `netstat -ano | grep :9999` 拿 PID 再 `taskkill //PID <pid> //F`。
(当时误测了一个僵尸进程，以为修复没生效。)

**6. ssh-action 的 script 拿不到 job 级 env**
`appleboy/ssh-action` 把 `script:` 内容**原样**送到服务器执行，中间没有任何一层 shell
会展开 `$VAR`。workflow 的 job 级 `env:` 只存在于 **runner 进程**上，远端读不到。
不加 `with.envs: VAR1,VAR2` 的话 `$DEPLOY_DIR` 在服务器上是空字符串 ——
`cd $DEPLOY_DIR` 静默退化成 `cd`（回 home），再拿着空路径去找文件，
报错信息里路径全空，极具误导性。GitHub 只替换 `${{ }}` 语法，不碰裸的 `$VAR`。

**7. jsonb 双重编码 —— 只有真实数据才暴露，且会「静默错答」**
迁移脚本原来对 `tags` 做了 `JSON.stringify`。但 **mysql2 已经把 MySQL 的 `json` 列
解析成 JS 值**了，而 **postgres.js 对 jsonb 参数自己还会 `JSON.stringify` 一次** ——
于是 PG 里存的是 JSON **字符串** `"[\"算法\"]"` 而不是数组 `["算法"]`。
（源库本身没问题，`json_type(tags)` 是 `ARRAY`。坏的是迁移这一步。）

两个后果，一个比一个阴:

- `/stats/tag-distribution` 的 `jsonb_array_elements_text()` 直接报
  `cannot extract elements from a scalar` → **500**。这个还算好，至少炸了。
- `questions.handlers.ts` 按标签筛选走 `tags @> '["算法"]'::jsonb`，对上字符串**恒为假**
  → **200 但返回空集**。空库时测不出来（没数据就没报错、也没结果），
  真实数据一进来才发现「按标签搜什么都搜不到」。

修法：`toJsonb` 数组/对象**原样透传**，别自己 stringify；字符串只在能解析出
数组/对象时才解析。**新增任何 jsonb 列时都要照着这条验一遍**
（`select jsonb_typeof(col) from ... group by 1` 应全是 `array`/`object`）。
顺带一提：这条也让 handoff 里「迁移脚本没在真实数据上跑过」的风险兑现了 ——
`--dry-run` 当时打印的标签分布是**脚本自己算的**，所以看着是对的，
但它没验证「写进 PG 之后」的形态。

## 两条不能碰的前端契约

它们不在任何 git 历史里,只看代码会以为是笔误而"顺手修掉",然后弄崩前端:

1. **路由不带任何前缀** —— 本地开发靠前端 Next rewrite(`/api/:path*` → `localhost:4000`),
   生产靠 nginx(`/api-hls/` → `127.0.0.1:4000/`,proxy_pass 末尾带 `/` 剥前缀)。
   两边都是在**外层**剥掉前缀,后端自己必须服务根路径,别在后端加前缀。
2. **`/auth/me` 必须返回字段 `name`**(不是 `username`);
   **`/stats/dashboard` 的 `videos` 字段必须存在**(前端 `home/page.tsx` 直接读 `stats.videos.totalVideos`)

## 开发命令

```bash
pnpm dev                 # 开发服务器(端口 9999)
pnpm test --run          # 单元测试
pnpm exec tsc --noEmit                        # 主代码类型检查
pnpm exec tsc -p tsconfig.scripts.json --noEmit  # 迁移脚本类型检查
pnpm db:generate && pnpm db:migrate           # 改完 schema.ts 后
```

本地 Postgres 跑在 `5433`(`docker compose` 起的),不是默认的 5432。

## 代码结构约定

每个模块三个文件:
- `*.routes.ts` —— zod 契约,**必须**以 `export type XxxRoute = typeof xxx` 结尾
- `*.handlers.ts` —— 薄 handler
- `*.index.ts` —— 路由装配

分层/过滤/分页一律下推到 SQL,不在 Node 内存里过滤(这是为了那台配置吃紧的服务器)。