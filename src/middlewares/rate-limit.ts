/**
 * 固定窗口限流中间件
 *
 * 场景:挡住 /auth/login、/auth/register 的暴力破解与批量注册。
 * 单容器部署,内存 Map 足够;将来多实例时换成 Redis 的 INCR + EXPIRE。
 *
 * 用法:
 *   app.use('/auth/login', rateLimit({ windowMs: 60_000, max: 30 }))
 *
 * key 取 x-forwarded-for 的第一段(nginx 反代已写入真实客户端 IP),
 * 取不到就归到 'unknown' 桶 —— 内网/本机调试共享一个桶,可接受。
 */

import { createMiddleware } from 'hono/factory'
import { HttpStatusCodes } from '../lib/openapi.js'

export interface RateLimitOptions {
    /** 窗口长度(毫秒) */
    windowMs: number
    /** 窗口内允许的最大请求数 */
    max: number
}

interface Bucket {
    count: number
    resetAt: number
}

const buckets = new Map<string, Bucket>()

// 防止长期运行后 Map 被废弃 key 撑大:清理时顺手做一次全量清扫。
// 请求频率低,代价可忽略;量级上来再换 Redis
function sweep(now: number) {
    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key)
    }
}

let lastSweep = 0

export const rateLimit = (options: RateLimitOptions) =>
    createMiddleware(async (c, next) => {
        const now = Date.now()

        if (now - lastSweep > options.windowMs) {
            sweep(now)
            lastSweep = now
        }

        const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
        const key = `${c.req.path}:${forwarded || 'unknown'}`

        let bucket = buckets.get(key)
        if (!bucket || bucket.resetAt <= now) {
            bucket = { count: 0, resetAt: now + options.windowMs }
            buckets.set(key, bucket)
        }

        bucket.count += 1

        if (bucket.count > options.max) {
            const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000)
            c.header('Retry-After', String(retryAfterSec))
            return c.json(
                { message: 'Too many requests, please try again later' },
                HttpStatusCodes.TOO_MANY_REQUESTS,
            )
        }

        await next()
    })
