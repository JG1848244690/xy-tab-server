# syntax=docker/dockerfile:1.7

# ---- 1. 安装全部依赖(含 dev)用于 build ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- 2. 编译 TypeScript → dist ----
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ---- 3. 仅安装生产依赖 ----
FROM node:22-alpine AS prod-deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ---- 4. 运行时镜像 ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# 用非 root 用户跑
RUN addgroup --system --gid 1001 hono \
 && adduser  --system --uid 1001 -G hono hono

# 拷贝运行时所需:生产 node_modules、编译产物、迁移文件、drizzle 配置、package.json
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build      /app/dist          ./dist
COPY --from=build      /app/drizzle.config.ts ./drizzle.config.ts
# migrations 目录通过 .gitkeep 占位确保进 git;后续 db:generate 会产出真正的迁移文件
COPY --from=build      /app/src/db/migrations ./src/db/migrations
COPY package.json ./

USER hono
EXPOSE 9999

# 默认启动编译产物;若需先跑迁移,把 CMD 换成:
#   ["sh","-c","pnpm db:migrate && node dist/index.js"]
CMD ["node", "dist/index.js"]