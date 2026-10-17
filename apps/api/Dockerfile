# syntax=docker/dockerfile:1.7

# monorepo 布局下的构建:context 是仓库根(docker-compose/CI 从根 build),
# dockerfile 指向 apps/api/Dockerfile。pnpm workspace 里装 hlse-api 一个包的依赖。

# ---- 1. 安装全部依赖(含 dev)用于 build ----
FROM node:22-alpine AS deps
WORKDIR /monorepo
RUN corepack enable
# workspace 清单 + 锁文件必须先于代码 COPY,层缓存才有效
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter hlse-api

# ---- 2. 编译 TypeScript → dist ----
FROM node:22-alpine AS build
WORKDIR /monorepo
RUN corepack enable
COPY --from=deps /monorepo/node_modules ./node_modules
COPY --from=deps /monorepo/apps/api/node_modules ./apps/api/node_modules
COPY package.json ./
COPY apps/api/ ./apps/api/
RUN pnpm --filter hlse-api build

# ---- 3. 仅安装生产依赖 ----
FROM node:22-alpine AS prod-deps
WORKDIR /monorepo
RUN corepack enable
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --prod --filter hlse-api

# ---- 4. 运行时镜像 ----
# 整个 workspace 树进来(pnpm 的 node_modules 是层层符号链接,
# 拆开拷会断;以 apps/api 为工作目录),只跑 dist + migrations
FROM node:22-alpine AS runner
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 hono \
    && adduser --system --uid 1001 -G hono hono

WORKDIR /app
# prod-deps 阶段已含:清单位置正确 + 生产 node_modules(root 与 apps/api 两层)
COPY --from=prod-deps --chown=hono:hono /monorepo /app
# 编译产物、迁移 SQL、drizzle 配置从 build 阶段拿
COPY --from=build --chown=hono:hono /monorepo/apps/api/dist /app/apps/api/dist
COPY --from=build --chown=hono:hono /monorepo/apps/api/drizzle.config.ts /app/apps/api/drizzle.config.ts
# migrations 目录通过 .gitkeep 占位确保进 git;后续 db:generate 会产出真正的迁移文件
COPY --from=build --chown=hono:hono /monorepo/apps/api/src/db/migrations /app/apps/api/src/db/migrations

WORKDIR /app/apps/api
USER hono
EXPOSE 9999

# 默认启动编译产物;若需先跑迁移,把 CMD 换成:
#   ["sh","-c","pnpm db:migrate && node dist/index.js"]
CMD ["node", "dist/index.js"]
