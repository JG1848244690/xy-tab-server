import { serve } from '@hono/node-server'
import app from './app.js'
import env from './env.js'
import db, { client } from './db/index.js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { MIGRATIONS_FOLDER, MIGRATIONS_SCHEMA, MIGRATIONS_TABLE } from './db/migrations-table.js'

const port = env.PORT

async function main() {
  // 启动前自动跑迁移——确保 db schema 是最新版本(配合 db:generate 的 SQL 文件)
  // 仅在生产容器内或本地启动时执行;迁移文件从 src/db/migrations/ 读取
  //
  // migrationsTable / migrationsSchema 必须显式传:drizzle 的 migrate() 默认去
  // `drizzle.__drizzle_migrations` 找记录,而 db:migrate 记在 `public.hlse_migrations`,
  // 对不上就认为所有迁移都没跑过,重放整批 SQL 并因 42710(CREATE TYPE 已存在)启动失败。
  // 三者共用 src/db/migrations-table.ts,不会漂移。
  console.log('Running migrations...')
  await migrate(db, {
    migrationsFolder: MIGRATIONS_FOLDER,
    migrationsTable: MIGRATIONS_TABLE,
    migrationsSchema: MIGRATIONS_SCHEMA,
  })
  console.log('Migrations applied.')

  serve({
    fetch: app.fetch,
    port,
  }, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
  })
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  // 关掉 db 连接再退出,避免 postgres-js 的 pool 留僵尸连接
  client.end({ timeout: 5 }).finally(() => process.exit(1))
})