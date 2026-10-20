import { z } from 'zod'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'

expand(config())

const EnvSchema = z.object({
    NODE_ENV: z.string().default('development'),
    PORT: z.coerce.number().default(9999),
    // 给默认值:以前少配这个 env 会直接在启动时 zod 抛错进程崩溃
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
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

    // 是否开放注册。生产默认开;需要封口时在服务器 .env 改成 false 重启即可
    REGISTRATION_ENABLED: z.enum(['true', 'false']).default('true'),

    // 是否在生产环境暴露 /doc 与 /reference(Scalar 文档)。默认关(B6):
    // 生产环境把 API 面完整暴露出去等于免费送攻击者踩点地图。
    // 调试需要时在 .env 设 true 重启,用完关掉
    ENABLE_API_DOCS: z.enum(['true', 'false']).default('false'),

    // ===== 防滥用(docs/abuse-defense-plan.md)=====
    // CF Turnstile 服务端密钥:留空 = 验证关闭(本地/测试);生产配上后注册必验
    TURNSTILE_SECRET_KEY: z.string().default(''),

    // CORS 白名单,逗号分隔。留空 = 不限制(本地开发/同源直连);
    // 生产填自己的前端 origin,其他来源不下发 Access-Control-Allow-Origin
    CORS_ORIGINS: z.string().default(''),

    // ===== 面试站 P0:AI 审核 agent(OpenAI 兼容协议) =====
    // 三项都留空 = agent 不可用:/review/* 触发接口返 503,其余功能不受影响。
    // 生产在服务器 .env 配;示例:
    //   LLM_BASE_URL=https://api.openai.com/v1   (或任何兼容网关)
    //   LLM_MODEL=gpt-4o-mini
    //   LLM_API_KEY=sk-...
    LLM_BASE_URL: z.string().default(''),
    LLM_MODEL: z.string().default(''),
    LLM_API_KEY: z.string().default(''),
})

export type env = z.infer<typeof EnvSchema>

let env: env
env = EnvSchema.parse(process.env)

export default env