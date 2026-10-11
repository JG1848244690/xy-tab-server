import { z } from 'zod'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'

expand(config())

const EnvSchema = z.object({
    NODE_ENV: z.string().default('development'),
    PORT: z.coerce.number().default(9999),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),
    DATABASE_URL: z.string().url(),
    // 用字符串枚举,避免 z.coerce.boolean() 把 "false" 转换成 true 的坑
    DATABASE_SSL: z.enum(['true', 'false']).default('false'),
    // OpenAPI 文档的 servers.basePath:挂在 nginx /api 反代后面时填 '/api',
    // Scalar / Swagger / 任何 OpenAPI 客户端会自动把它拼到每个 path 前。
    // 本机直连(无反代)留空,spec 里不设 servers,默认用 doc 自身 host。
    OPENAPI_BASE_PATH: z.string().default(''),

    // === 鉴权 ===
    // JWT 签名密钥。旧 Nest 项目里硬编码成了 'YOUR_SECRET_KEY_KEEP_IT_SAFE',
    // 任何人都能伪造登录态,这里必须改成随机强密钥并只存在服务器 .env。
    // 生成方式:openssl rand -base64 32
    JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),

    /**
     * 登录态 Cookie 名。旧前端(hlsEdu web-front)硬编码读 'Authentication',
     * 且 axios 走 withCredentials,依赖 HttpOnly Cookie —— 名字不能改,
     * 改了前端就登不上
     */
    AUTH_COOKIE_NAME: z.string().default('Authentication'),

    // 登录态有效期(秒),默认 1 天,与旧 Nest 的 maxAge 一致
    AUTH_COOKIE_MAX_AGE: z.coerce.number().default(86400),
})

export type env = z.infer<typeof EnvSchema>

let env: env
env = EnvSchema.parse(process.env)

export default env