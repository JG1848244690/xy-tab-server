import { defineConfig } from 'drizzle-kit'
import env from './src/env.js'

export default defineConfig({
    dialect: "postgresql",
    schema: "./src/db/schema.ts",
    out: "./src/db/migrations",
    dbCredentials: {
        url: env.DATABASE_URL,
    },
    migrations: {
        table: 'my-migrations-table', // `__drizzle_migrations` by default
        schema: 'public', // `public` by default
    },
});