import { z } from 'zod'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'

expand(config())

const EnvSchema = z.object({
    NODE_ENV: z.string().default('development'),
    PORT: z.coerce.number().default(9999),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),
    DATABASE_URL: z.string().url(),
    // 用字符串枚举,避免 z.coerce.boolean() 把"false" 转换成 true 的坑
    DATABASE_SSL: z.enum(['true', 'false']).default('false'),
    // OpenAPI 文档的 servers.basePath:挂在 nginx /api 反代后面时填 '/api',
    // Scalar / Swagger / 任何 OpenAPI 客户端会自动把它拼到每个 path 前。
    // 本机直连(无反代)留空,spec 里不设 servers,默认用 doc 自身 host。
    OPENAPI_BASE_PATH: z.string().default(''),

    // === 云同步(Google OAuth)===
    GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required for sync'),
    GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required for sync'),
    // 前端发来的 redirect_uri 必须和 Google Console 配置的完全一致
    // 开发时插件拿到的 redirect_uri 是 https://<EXT_ID>.chromiumapp.org/
    // 这里给前端做校验用,生产时可放宽
    GOOGLE_ALLOWED_REDIRECT_REGEX: z.string().default('^https://[a-z]+\.chromiumapp\.org/$'),
})

export type env = z.infer<typeof EnvSchema>

let env: env
env = EnvSchema.parse(process.env)

export default env
