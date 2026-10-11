/**
 * 迁移记录表的表名。
 *
 * 必须与 drizzle.config.ts 的 migrations.table 保持一致,否则:
 *   - db:migrate(drizzle-kit)把"已应用"记进 hlse_migrations
 *   - 启动时的 migrate() 去找默认的 __drizzle_migrations,发现是空表
 *   → 认为所有迁移都没跑过,重放整批 SQL → CREATE TYPE "difficulty" 已存在(42710)
 *
 * 抽成单独文件,让 drizzle.config.ts 和 src/index.ts 共用同一个来源。
 */
export const MIGRATIONS_TABLE = 'hlse_migrations'

/**
 * 迁移表所在的 schema。
 *
 * migrate() 不传 migrationsSchema 时默认用 `drizzle`,而 db:migrate 记在 `public`,
 * 两边不在同一个 schema → 代码侧查到空表 → 重放整批 SQL → 42710。
 */
export const MIGRATIONS_SCHEMA = 'public'

/** 迁移文件目录。容器里 /app/src/db/migrations,与 Dockerfile 的 COPY 目标一致 */
export const MIGRATIONS_FOLDER = './src/db/migrations'
