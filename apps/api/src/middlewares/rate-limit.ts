/**
 * 固定窗口限流中间件
 *
 * 场景:挡住 /auth/login、/auth/register 的暴力破解与批量注册。
 * 单容器部署,内存 Map 足够;将来多实例时换成 Redis 的 INCR + EXPIRE。
 *
 * 用法:
 *   app.use('/auth/login', rateLimit({ windowMs: 60_000, max: 30 }))
 *
 * 取限流 key 的 IP 规则(B5,配合 docker-compose 只绑 127.0.0.1):
 *   链路:客户端 → Cloudflare → nginx → app
 *   - cf-connecting-ip:CF 边缘强制覆盖,客户端伪造不了,nginx 原样透传 —— 首选。
 *     端口收紧后想裸连 app 伪造这个头,得先拿到服务器本地权限;
 *   - x-real-ip:nginx 写的是 $remote_addr(CF 边缘 IP)。整条 "绕过 CF 直打
 *     服务器" 的路径都会归到这一个桶,可接受(conservative,只会更严不会更松);
 *   - 都没有:退回 TCP 对端地址(本地 dev 直连 / 本机调试)。
 *
 * 以前无条件取 x-forwarded-for 第一段:绕过 nginx 直连宿主端口时,
 * 每次换个 XFF 就能全新桶,暴力破解限流等于没有;还能伪造受害者 IP
 * 把人顶进限流桶。
 */

import { createMiddleware } from 'hono/factory'
import { getConnInfo } from '@hono/node-server/conninfo'
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

/** 限流 key 里可靠的客户端标识(见文件头规则) */
function clientKey(c: Parameters<ReturnType<typeof createMiddleware>>[0]): string {
    const cfIp = c.req.header('cf-connecting-ip')
    if (cfIp) return cfIp.trim()

    const realIp = c.req.header('x-real-ip')
    if (realIp) return `no-cf:${realIp.trim()}`

    // 本地 dev 直连:取 TCP 对端。测试环境(app.request)没有底层连接,抛错兜 'unknown'
    try {
        const info = getConnInfo(c)
        return info?.remote?.address ?? 'unknown'
    } catch {
        return 'unknown'
    }
}

export const rateLimit = (options: RateLimitOptions) =>
    createMiddleware(async (c, next) => {
        const now = Date.now()

        if (now - lastSweep > options.windowMs) {
            sweep(now)
            lastSweep = now
        }

        const key = `${c.req.path}:${clientKey(c)}`

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
                {
                    message: 'Too many requests, please try again later',
                    code: 'RATE_LIMITED',
                },
                HttpStatusCodes.TOO_MANY_REQUESTS,
            )
        }

        await next()
    })
