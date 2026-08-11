# Hono Base

基于 **Hono** 的 TypeScript 后端基础架子。核心理念:**用一份 Zod schema,同时驱动「运行时校验 + TypeScript 类型 + OpenAPI 文档」**——契约优先,一处定义,三处复用。

## 技术栈

| 用途 | 库 |
|------|-----|
| Web 框架 | [Hono](https://hono.dev) |
| Node 适配 | `@hono/node-server` |
| OpenAPI + 校验 | `@hono/zod-openapi` + [Zod](https://zod.dev) |
| API 文档 UI | [`@scalar/hono-api-reference`](https://github.com/scalar/scalar) |
| ORM | [Drizzle ORM](https://orm.drizzle.team) |
| 数据库 | [PostgreSQL](https://www.postgresql.org)— driver: [postgres.js](https://github.com/porsager/postgres) (`postgres` + `drizzle-orm/postgres-js`) |
| 日志 | `pino` + `pino-pretty` + `hono-pino` |
| 配置加载 | `dotenv` + `dotenv-expand` |
| 脚手架工具 | [stoker](https://github.com/w3cj/stoker) |
| 开发 / 构建 | `tsx` + TypeScript |

## 目录结构

```
src/
├── index.ts                    # 入口:启动 HTTP 服务
├── app.ts                      # 装配:组合路由 + 配置 OpenAPI
├── env.ts                      # 环境变量(Zod 校验 + 类型化)
├── lib/
│   ├── create-app.ts           # 工厂:创建实例 + 挂全局中间件
│   ├── configure-open-api.ts   # 注册 /doc 与 /reference
│   └── types.ts                # AppBindings / AppOpenAPI 类型
├── middlewares/
│   └── pino-logger.ts          # Pino 日志中间件封装
└── routes/
    └── index.route.ts          # 路由定义
```

## 环境变量

在项目根目录创建 `.env`(已被 `.gitignore` 忽略,不会提交):

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `NODE_ENV` | string | `development` | 运行环境 |
| `PORT` | number | `9999` | 服务端口 |
| `LOG_LEVEL` | enum | **(必填)** | `fatal` / `error` / `warn` / `info` / `debug` / `trace` |
| `DATABASE_URL` | string | **(必填)** | PostgreSQL 连接 URL,如 `postgresql://user:pass@host:5432/db` |
| `DATABASE_SSL` | boolean | `false` | 是否启用 SSL;连本地 Docker 无需,生产托管 PG 一般要 `true` |

> ⚠️ `LOG_LEVEL` 无默认值,`.env` 不配置会导致启动失败(Fail Fast)。

示例:

```env
NODE_ENV=development
PORT=9999
LOG_LEVEL=debug
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tasks
```

## 快速开始

前置:Node.js 与 pnpm。

```bash
pnpm install      # 安装依赖
pnpm dev          # 开发模式(热重载)→ http://localhost:9999
pnpm build        # 编译到 dist/
pnpm start        # 运行编译产物 node dist/index.js
```

## 数据库 (Drizzle)

数据层使用 [Drizzle ORM](https://orm.drizzle.team) 连接 **PostgreSQL**(driver: [postgres.js](https://github.com/porsager/postgres))。

- Schema 定义:`src/db/schema.ts`(基于 `drizzle-orm/pg-core`)
- 迁移文件输出:`src/db/migrations/`
- 连接配置:`drizzle.config.ts`(读取 `DATABASE_URL`,`dialect: "postgresql"`)

### 本地起一个 Postgres

最方便的是 docker:

```bash
docker run -d --name tasks-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=tasks -p 5432:5432 postgres:17-alpine
```

然后 `.env` 写:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tasks
```

`package.json` 里预置了四条 `db:*` 脚本(对应 `drizzle-kit` 命令):

| 命令 | 对应 | 作用 |
|------|------|------|
| `pnpm db:generate` | `drizzle-kit generate` | 根据 schema 变化**生成 SQL 迁移文件**,不改动数据库 |
| `pnpm db:migrate` | `drizzle-kit migrate` | 把生成的迁移文件**执行到数据库**,按顺序记账,幂等 |
| `pnpm db:push` | `drizzle-kit push` | 跳过迁移文件,**直接把 schema 同步到库**(本地快速原型) |
| `pnpm db:studio` | `drizzle-kit studio` | 打开 Drizzle Studio 可视化管理数据库 |

### 推荐工作流

- **本地快速迭代**:改完 `schema.ts` 直接 `pnpm db:push`,库结构即时同步,无需关心迁移文件。
- **正式 / 团队协作**:`pnpm db:generate` 产出可 review 的迁移文件 → `pnpm db:migrate` 应用,保留版本化历史。

> ⚠️ `db:push` 会直接改库结构(删列、改类型同样照做),**仅用于本地开发**;生产环境请走 `generate + migrate`。

## 架构

### 请求流转

```
请求
  ↓
@hono/node-server   HTTP 接入
  ↓
serveEmojiFavicon   🔥 favicon
  ↓
pinoLogger          记录请求 + 注入 logger 到 context
  ↓
prettyJSON          支持 ?pretty 美化 JSON 响应
  ↓
cors                跨域处理
  ↓
路由匹配            按 createRoute 契约校验入参 / 出参
  ↓
handler             业务处理
  ↓
notFound / onError  兜底(404 / 500)
  ↓
响应
```

### 关键模块职责

| 模块 | 职责 |
|------|------|
| `index.ts` | 用 `@hono/node-server` 的 `serve()` 在 Node 上启动 Hono |
| `env.ts` | 用 Zod 校验 `process.env`,自动推导类型,启动即校验(Fail Fast) |
| `lib/create-app.ts` | 创建 `OpenAPIHono` 实例,挂载全局中间件与错误兜底 |
| `lib/configure-open-api.ts` | 汇总所有路由为 OpenAPI 文档,挂载 Scalar UI |
| `middlewares/pino-logger.ts` | 开发环境用 `pino-pretty` 美化日志,生产环境输出 JSON |
| `app.ts` | 把所有路由挂到 `/`,统一配置 OpenAPI |

### 核心理念:契约优先

每个路由用 `createRoute({...})` 声明契约,handler 负责真正处理。同一份 Zod schema 在三个地方生效:

```
        ┌──→ 运行时校验(请求体/参数不合法 → 直接 400)
Schema ─┼──→ TypeScript 类型(z.infer 自动推导,handler 全程类型安全)
        └──→ OpenAPI 文档(自动生成,显示在 /reference)
```

这就是整套架子选 Zod 的根本原因——校验、类型、文档从来不是三份要分别维护的东西。

## API 文档

启动服务后,直接在浏览器访问:

- **交互式文档(Scalar)**:<http://localhost:9999/reference>
- **OpenAPI JSON**:<http://localhost:9999/doc>

### 当前端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/` | 健康检查,返回 `{ "message": "task" }` |
| `GET` | `/doc` | OpenAPI 3.0 JSON 文档 |
| `GET` | `/reference` | Scalar 交互式文档 UI |

## 新增路由

以 `GET /tasks/:id` 为例,展示带路径参数校验的完整写法:

```ts
// src/routes/tasks.route.ts
import { createRouter } from '../lib/create-app.js'
import { createRoute } from '@hono/zod-openapi'
import { jsonContent } from 'stoker/openapi/helpers'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { IdParamsSchema } from 'stoker/openapi/schemas'
import { z } from 'zod'

const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
})

const router = createRouter().openapi(
  createRoute({
    method: 'get',
    tags: ['Tasks'],
    path: '/tasks/{id}',
    request: {
      params: IdParamsSchema,                      // 校验路径参数 :id
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(TaskSchema, '获取成功'),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        z.object({ message: z.string() }),
        '任务不存在',
      ),
    },
  }),
  (c) => {
    const { id } = c.req.valid('param')            // 已校验、已类型化
    return c.json({ id, title: '示例任务', done: false }, HttpStatusCodes.OK)
  },
)

export default router
```

然后在 `app.ts` 的 `routes` 数组里挂载:

```ts
import tasks from './routes/tasks.route.js'

const routes = [index, tasks]
```

重新启动后,新接口会自动出现在 `/reference` 文档页面。
