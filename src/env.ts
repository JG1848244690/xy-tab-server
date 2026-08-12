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

    // 云同步已不需要 GOOGLE_CLIENT_ID/SECRET:
    //   - 扩展用 chrome.identity.getAuthToken 拿 token
    //   - 扩展自己 fetch Google userinfo(走用户浏览器出公网)
    //   - 后端只接 userinfo JSON 颁发 sessionToken,零 Google API 调用
    // 保留历史 GOOGLE_* 变量为可选(便于审计/旧部署日志),不读取
})

export type env = z.infer<typeof EnvSchema>

let env: env
env = EnvSchema.parse(process.env)

export default env
