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

    // Google OAuth client_id — 用于 id_token 验签时的 audience 校验。
    // 扩展 launchWebAuthFlow 用同一个 client_id,从 Google Console 注册时拿到。
    // 真值在服务器 .env (.gitignore),绝不能进 git / CI log / 镜像
    GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID required for id_token audience check'),
})

export type env = z.infer<typeof EnvSchema>

let env: env
env = EnvSchema.parse(process.env)

export default env
