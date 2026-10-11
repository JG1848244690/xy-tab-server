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
- MySQL → PG 存量数据迁移脚本(`scripts/migrate-mysql-to-pg.ts`,见下)

### 未完成(下次接着做)

1. **前端 `next.config.ts` 的 rewrite destination 硬编码 `localhost:4000`** ——
   **阻塞部署**。axios 走 `baseURL: '/api'`,靠这个 rewrite 剥掉前缀打到后端根路径,
   不改的话上了服务器所有请求全挂。
   (另 3 处硬编码在 `courses/` 的视频组件里,视频模块已砍,可不管)
2. **CI secrets 未配置**:`SERVER_HOST` / `SERVER_USER` / `SERVER_SSH_KEY` 三个还没填。
   填之前 deploy job 会失败。
3. **服务器上 `/opt/hls-api/.env` 需手动创建**,CI 里有检查并给出了提示,但首次部署仍会失败一次。
4. **服务器上这个仓库的 remote 名待确认** —— CI 里写的是 `github`(照抄旧 deploy 脚本),
   实际可能是 `origin`。在 `.github/workflows/ci.yml` 的 `DEPLOY_REMOTE` 改。
5. **存量数据尚未导入** —— 迁移脚本写完但没跑过真实数据(见下)。

## 迁移脚本:必须先跑 dry-run

```bash
pnpm db:import --dry-run    # 只读,不写库
pnpm db:import              # 实际导入(单事务,失败整体回滚)
pnpm db:import --truncate   # 重跑时用,先清空目标表
```

源库密码走交互式询问(不回显),或 `MYSQL_PASSWORD` 环境变量。**不要**写进命令行或文件。

**未验证的部分**:脚本的类型检查过了、连接/参数/报错路径都冒烟测过了,
但**真实的类型转换分支一行都没跑过**(当时拿不到 MySQL 密码)。
第一次跑 dry-run 重点看两处:

- **主键映射**。旧代码是 `@PrimaryColumn(varchar 36)` 而非 `@PrimaryGeneratedColumn`,
  id 由应用生成,不保证是合法 uuid。脚本会逐个校验,非法的生成新 uuid 并同步改写
  `questions.created_by` 和 stats/attempts/todos 的全部外键。dry-run 第一段会报有多少个要重映射。
- **中文标签**。`tags` 走 `json` → `jsonb`,脚本会打印标签分布,中文乱码一眼能看出来。
  (历史上踩过 Windows Git Bash 把命令行参数里的中文变成 U+FFFD 的坑,写测试时注意。)

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

## 两条不能碰的前端契约

它们不在任何 git 历史里,只看代码会以为是笔误而"顺手修掉",然后弄崩前端:

1. **路由不带 `/api` 前缀** —— 前端 axios 用 `baseURL: '/api'`,靠 Next rewrite 剥前缀打到后端根路径
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