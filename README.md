# hlsEdu API

hlsEdu 的后端服务。Hono + Zod OpenAPI + Drizzle ORM + PostgreSQL。

本分支(`hls-api`)把原来那套 NestJS + MySQL 的服务重写了一遍,目标是能部署到配置吃紧的服务器上,所以数据查询尽量下推到 SQL,不做"全表拉进 Node 内存再过滤分页"。

## 模块范围

本轮实现 4 个模块,**视频模块不迁**:

| 模块 | 说明 |
|------|------|
| `auth` | 注册 / 登录 / 登出 / 当前用户。HttpOnly Cookie + JWT,密码 bcrypt(cost 10) |
| `questions` | 题库 CRUD、提交作答、人工判分、作答历史、练习汇总 |
| `todos` | 日历打卡,支持跨天事件 |
| `stats` | 首页概览、练习趋势、标签/难度分布、未完成与最近列表 |

前端契约有两处**不能改**,否则旧 Next.js 前端会崩:

- `GET /auth/me` 的响应必须带 `name` 字段(不是 `username`)。旧 Nest controller 显式做过 `username -> name` 映射,前端 layout 在读。
- `GET /stats/dashboard` 的 `videos` 必须是结构完整的空对象。前端 `home/page.tsx` 直接读 `stats.videos.totalVideos` 等字段,缺字段会崩。等视频接口做完后,把 `stats.routes.ts` 的 `emptyVideosSchema` 换成真实数据即可,前端不用动。

## 技术栈

| 用途 | 库 |
|------|----|
| Web 框架 | [Hono](https://hono.dev) |
| Node 适配 | `@hono/node-server` |
| OpenAPI + 校验 | `@hono/zod-openapi` + [Zod](https://zod.dev) |
| API 文档 UI | [`@scalar/hono-api-reference`](https://github.com/scalar/scalar) |
| ORM | [Drizzle ORM](https://orm.drizzle.team) |
| 数据库 | PostgreSQL — driver [postgres.js](https://github.com/porsager/postgres) |
| 日志 | `pino` + `pino-pretty` + `hono-pino` |
| 配置加载 | `dotenv` |

## 快速开始

```bash
pnpm install
cp .env.example .env      # 填 JWT_SECRET 等
docker compose up -d postgres
pnpm db:generate          # 改了 schema.ts 之后才需要
pnpm db:migrate
pnpm dev                  # → http://localhost:9999
```

`docker-compose.yml` 里除了 postgres 还定义了 app 服务:

```bash
docker compose up -d --build    # 容器里跑完整服务(启动时会自动跑迁移)
```

## 环境变量

`.env` 已被 `.gitignore` 忽略,不会提交。

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `NODE_ENV` | string | `development` | 运行环境 |
| `PORT` | number | `9999` | 服务端口 |
| `LOG_LEVEL` | enum | **(必填)** | `fatal` / `error` / `warn` / `info` / `debug` / `trace` |
| `DATABASE_URL` | string | **(必填)** | PostgreSQL 连接 URL |
| `DATABASE_SSL` | boolean | `false` | 连本地 Docker 无需,托管 PG 一般要 `true` |
| `OPENAPI_BASE_PATH` | string | `''` | 只影响文档里的 `servers`,**不影响实际路由** |
| `JWT_SECRET` | string | **(必填)** | JWT 签名密钥,至少 16 字符。生成:`openssl rand -base64 32` |
| `AUTH_COOKIE_NAME` | string | `Authentication` | 登录态 Cookie 名,前端依赖这个默认值 |
| `AUTH_COOKIE_MAX_AGE` | number | `86400` | Cookie 有效期(秒),同时也决定 token 过期时间 |

> ⚠️ `JWT_SECRET` 泄漏 = 任何人都能伪造登录 Cookie。生产环境用 secret 管理,别写进镜像或 CI 日志。

> ⚠️ 必填项没配会直接启动失败(Fail Fast),不会带着半截配置跑起来。

## 数据库

Schema 在 `src/db/schema.ts`,迁移文件在 `src/db/migrations/`。

| 表 | 说明 |
|------|------|
| `users` | 账号 |
| `questions` | 题库,`tags` 是 `jsonb` 且建了 GIN 索引 |
| `question_stats` | 每用户每题的练习状态,复合主键 `(user_id, question_id)` |
| `question_attempts` | 作答流水 |
| `todos` | 日历打卡,`start_date ~ end_date` 支持跨天 |

三个 `pgEnum`:`question_type` / `difficulty` / `question_status`。

### 迁移工作流

```bash
pnpm db:generate   # 改完 schema.ts 后生成 SQL 迁移文件
pnpm db:migrate   # 把迁移应用到数据库(幂等)
pnpm db:studio    # 可视化查看数据
```

服务启动时也会自动跑一次迁移(`src/index.ts`)。

> ⚠️ 迁移表名 `hlse_migrations` 与所在 schema `public` 定义在 `src/db/migrations-table.ts`,由 `drizzle.config.ts` 和 `src/index.ts` **共用同一个常量**。不要在任一侧写死 —— 两边不一致会让启动时误判"所有迁移都没跑过",重放整批 SQL 并因 `42710`(CREATE TYPE 已存在)启动失败。

> ⚠️ `db:push` 会直接改库结构,仅用于本地快速迭代,不要在生产用。

### 从旧 MySQL 库搬存量数据

> 现状:服务器本机的 `hls_edu` 库里**只有** `users` / `videos` / `collections` / `learning_progress`
> 四张表,**没有**要迁的 `questions` / `question_stats` / `question_attempts` / `todos`。
> 也就是说在这台机器上跑迁移脚本会是空跑,要迁的真实数据还在别处(待确认)。

旧后端(NestJS + TypeORM + MySQL `hls_edu`)的数据用 `scripts/migrate-mysql-to-pg.ts` 搬过来:

```bash
pnpm db:import --dry-run    # 只读:打印行数、id 检查结果、标签分布,不写库
pnpm db:import              # 实际导入(单事务,失败整体回滚)
pnpm db:import --truncate   # 导入前先清空目标表(重复导入旧数据时用)
```

目标库连接串取 `.env` 里的 `DATABASE_URL`。在服务器上跑的话,PG 容器映射在宿主机 **5434**:

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5434/hlse pnpm db:import --dry-run
```

源库连接参数走环境变量,**密码不落盘**:

| 变量 | 默认值 |
|------|--------|
| `MYSQL_HOST` | `localhost` |
| `MYSQL_PORT` | `3306` |
| `MYSQL_USER` | `root` |
| `MYSQL_DATABASE` | `hls_edu` |
| `MYSQL_PASSWORD` | 无 —— 不设则交互式询问(不回显) |

脚本处理的类型差异:

- **主键**:旧代码是 `@PrimaryColumn(varchar 36)`,id 由应用生成,不保证合法。脚本逐个校验,非法的生成新 uuid 并同步改写所有引用(questions.created_by、attempts/stats/todos 的 user_id 等)
- `json tags` → `jsonb`;`tinyint` → `boolean`;`date` → `date`;`time` → `'HH:mm'` 字符串
- `password` 原样搬(旧项目就是 bcrypt hash,bcryptjs 直接兼容,老账号不用重置密码)
- 孤儿外键行(引用了不存在的 user/question)会被**丢弃并打印数量**,不会让整个事务挂掉

视频相关的 3 张表(`videos` / `collections` / `learning_progress`)本轮不迁,新 schema 里也没有对应表。

## API 文档

- 交互式文档(Scalar):<http://localhost:9999/reference>
- OpenAPI JSON:<http://localhost:9999/doc>

### 端点一览

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/auth/register` | 注册(不下发登录态,前端注册后再走一次 login) |
| `POST` | `/auth/login` | 登录,下发 HttpOnly Cookie |
| `POST` | `/auth/logout` | 登出 |
| `GET` | `/auth/me` | 当前用户 |
| `GET` | `/questions` | 分页列表,支持 `type` / `difficulty` / `tag` / `status` / `search` / `ordering` |
| `POST` | `/questions` | 创建 |
| `GET` | `/questions/stats` | 当前用户练习汇总 |
| `GET` | `/questions/{id}` | 详情(含答案,练习页要用) |
| `PUT` | `/questions/{id}` | 更新(仅创建者) |
| `DELETE` | `/questions/{id}` | 删除(仅创建者) |
| `POST` | `/questions/{id}/submit` | 提交作答 |
| `GET` | `/questions/{id}/attempts` | 该题作答历史 |
| `PATCH` | `/questions/{id}/attempts/{attemptId}` | 人工判分 |
| `GET` | `/todos/by-date?date=` | 按日期取(含跨天事件) |
| `GET` | `/todos/by-month?year=&month=` | 按月取(含跨天事件) |
| `GET` | `/todos/month-status?year=&month=` | 该月打卡日期,分完成/未完成 |
| `POST` | `/todos` | 创建 |
| `PATCH` | `/todos/{id}` | 更新 |
| `PATCH` | `/todos/{id}/toggle` | 切完成状态 |
| `DELETE` | `/todos/{id}` | 删除 |
| `GET` | `/stats/dashboard` | 首页概览 |
| `GET` | `/stats/practice-trend?days=&type=` | 练习趋势(`frequency` 次数 / `duration` 分钟) |
| `GET` | `/stats/tag-distribution` | 标签占比 |
| `GET` | `/stats/difficulty-distribution` | 难度占比 |
| `GET` | `/stats/incomplete-questions` | 未完成题目 |
| `GET` | `/stats/recent-added-questions` | 最近添加 |
| `GET` | `/stats/recent-completed-questions` | 最近完成 |

## 路径与鉴权

**路由不带 `/api` 前缀。** 旧前端的 axios 用 `baseURL: '/api'`,由 Next.js rewrite 剥掉前缀后才打到后端根路径 —— 所以后端必须服务根路径。服务器上的 nginx 也照这个约定配。

除 `/auth/*` 外全部接口都需要登录态,鉴权走 `middlewares/auth.ts` 的 `cookieAuth`,读 `AUTH_COOKIE_NAME` 指定的 Cookie。

## 契约优先

每个模块三个文件:

```
src/routes/questions/
├── questions.routes.ts    # createRoute 契约 —— 校验、类型、文档三处复用
├── questions.handlers.ts  # 业务逻辑
└── questions.index.ts     # createRouter().openapi(...) 组装
```

同一份 Zod schema 在三个地方生效:运行时校验入参、`z.infer` 推导 TypeScript 类型、自动生成 OpenAPI 文档。

> ⚠️ 有几处 TS 细节绕不过去,改动时注意:
> - `c.json()` 在 200 和 422 组成 union 时推断会被卡住 —— 成功分支显式传 `HttpStatusCodes.OK` 收窄。
> - Zod 3.25 没有 `z.uuid()`,用 `z.string().uuid()`。
> - 每个 routes 文件末尾要 `export type XxxRoute = typeof xxx`,handler 靠它取类型。

## 测试

```bash
pnpm test
```

`src/routes/auth/auth.test.ts` 用 `vi.mock` 把 db 换成链式假对象,不连真实数据库。覆盖登录态契约(`name` 字段、HttpOnly Cookie)和鉴权边界(无 token / 伪造 token / 用户已删除)。

## 部署

`Dockerfile` 是多阶段构建,`docker-compose.yml` 里 app 服务的镜像默认 `ghcr.io/jg1848244690/hls-api:${IMAGE_TAG}`。

CI(`.github/workflows/ci.yml`)在 push / PR 时跑 typecheck → test → build → 构建镜像推 GHCR;
`deploy` job 只在 push `hls-api` 分支时触发,镜像 tag 用**完整 40 位 commit SHA**
(不是 `--short` —— CI 推的 tag 是 `${{ github.sha }}`,短 SHA 对不上会 `pull` 失败)。

### 服务器上的实际布局

和老的 tasks-api 服务**同一台机器并存**,靠目录 / 端口 / 子路径错开:

| | 老服务 | 本服务 |
|---|---|---|
| 目录(= compose 项目名) | `/opt/tasks-api` | `/opt/hls-api` |
| 镜像 | `xy-tab-server` | `hls-api` |
| app 宿主端口 | 9999 | 4000 |
| PG 宿主端口 | 5433 | 5434 |
| 对外路径 | `kskbl.com.cn/api` | `kskbl.com.cn/api-hls` |
| DB / 卷 | `tasks` / `tasks-pg-data` | `hlse` / `hlse-pg-data` |

部署相关变量都在服务器 `/opt/hls-api/.env`(不进 git,CI 只做 `git fetch/reset` + `docker compose pull/up`):
`PORT=4000`、`PG_HOST_PORT=5434`、`OPENAPI_BASE_PATH=/api-hls`、`JWT_SECRET`。
`.env` 里不设 `DATABASE_URL`(compose 已写死 `postgresql://postgres:postgres@postgres:5432/hlse`)。

nginx 走宝塔的 extension 钩子,不动 `html_kskbl.com.cn.conf` 本体:把仓库里的
`deploy/nginx/kskbl.com.cn-api-hls.conf` 装到
`/www/server/panel/vhost/nginx/extension/kskbl.com.cn/hls-api.conf`,然后 `nginx -t && nginx -s reload`。

> ⚠️ `/api-hls/` 的 `proxy_pass` 末尾必须带 `/`(剥掉前缀),后端路由本身不带任何前缀。

> ⚠️ 服务器内存只有 1.6G,四套容器(app + PG)× 2 已占 ~150M,加镜像/构建缓存前先看 `df -h`。
