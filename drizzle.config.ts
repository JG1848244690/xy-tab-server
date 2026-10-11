import { defineConfig } from 'drizzle-kit'
import env from './src/env.js'
import { MIGRATIONS_TABLE } from './src/db/migrations-table.js'

export default defineConfig({
    dialect: "postgresql",
    schema: "./src/db/schema.ts",
    out: "./src/db/migrations",
    dbCredentials: {
        url: env.DATABASE_URL,
    },
    migrations: {
        // hlsEdu 独立库,用独立的迁移表名(默认 __drizzle_migrations)。
        // src/index.ts 启动时跑的 migrate() 也读这个常量,两边不会漂移
        table: MIGRATIONS_TABLE,
        schema: 'public',
    },
});