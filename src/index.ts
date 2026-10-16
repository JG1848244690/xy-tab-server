import { serve } from '@hono/node-server'
import app from './app.js'
import env from './env.js'
import db, { client } from './db/index.js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { MIGRATIONS_FOLDER, MIGRATIONS_SCHEMA, MIGRATIONS_TABLE } from './db/migrations-table.js'

const port = env.PORT

async function main() {
  // 启动前自动跑迁移——确保 db schema 与代码一致(配合 db:generate 产 SQL 文件)
  // 仅在生产容器内或本地启动时执行;迁移文件在 src/db/migrations/ 读取
  //
  // migrationsTable / migrationsSchema 必须显式传:drizzle 的 migrate() 默认记在
  // `drizzle.__drizzle_migrations`,而 db:migrate 记在 `public.hlse_migrations`,
  // 对不上就认为所有迁移都没跑过,重放整批 SQL 并因 42710(CREATE TYPE 已存在)
  // 启动失败。三者共用 src/db/migrations-table.ts,不会漂移。
  console.log('Running migrations...')
  await migrate(db, {
    migrationsFolder: MIGRATIONS_FOLDER,
    migrationsTable: MIGRATIONS_TABLE,
    migrationsSchema: MIGRATIONS_SCHEMA,
  })
  console.log('Migrations applied.')

  const server = serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      console.log(`Server is running on http://localhost:${info.port}`)
    },
  )

  // ============================================================
  // 优雅停机(B11):docker stop 发 SIGTERM 时,
  // 1. 停止接收新连接(server.close),等在途请求跑完(最多 8s,
  //    docker stop 默认 10s 宽限,要留出余量);
  // 2. 关掉空闲 keep-alive 连接,否则 server.close 的回调要等
  //    客户端 keep-alive 超时才触发,根本等不到;
  // 3. 关闭 pg 连接池后退出。以前什么都不做,在途请求直接被腰斩。
  // ============================================================
  let shuttingDown = false

  async function shutdown(signal: string) {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`${signal} received, shutting down gracefully...`)

    const forceExit = setTimeout(() => {
      console.error('Grace period exceeded, forcing exit')
      process.exit(1)
    }, 8_000)
    forceExit.unref()

    try {
      // @hono/node-server 返回的是 node http server,closeIdleConnections 在
      // Node >= 18.2 可用;类型上未必暴露,运行时探测
      const nodeServer = server as unknown as { closeIdleConnections?: () => void }
      nodeServer.closeIdleConnections?.()
      await new Promise<void>((resolve) => server.close(() => resolve()))
      await client.end({ timeout: 5 })
      console.log('Shutdown complete')
      process.exit(0)
    } catch (err) {
      console.error('Error during shutdown:', err)
      process.exit(1)
    }
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  // 关掉 db 连接再退出,避免 postgres-js 的 pool 留僵尸连接
  client.end({ timeout: 5 }).finally(() => process.exit(1))
})
