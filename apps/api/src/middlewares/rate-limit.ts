/**
 * 固定窗口限流中间件
 *
 * 场景:挡住 /auth/login、/auth/register 的暴力破解与批量注册。
 * 单容器部署,内存 Map 足够;将来多实例时换成 Redis 的 INCR + EXPIRE。
 *
 * 用法:
 *   app.use('/auth/login', rateLimit({ windowMs: 60_000, max: 30 }))
 *
 * 取限流 key 的 IP 规则(B5 + 2026-11-13 加固):
 *   链路:客户端 → nginx → app(app 只绑 127.0.0.1,外网进不来)
 *   - x-real-ip:nginx 用 $remote_addr 覆写 —— 首选;
 *   - cf-connecting-ip:nginx 同样覆写(防客户端自带);仅在没有 nginx 时兜底;
 *   - 都没有:退回 TCP 对端地址(本地 dev 直连 / 本机调试)。
 *
 * 以前优先信 cf-connecting-ip,而 nginx 会原样透传客户端自带的同名头,
 * 于是「429 之后换一个 CF-Connecting-IP 就恢复 200」——限流等于没有。
 * 已在 2026-11-13 实测复现并修复:nignx 侧 proxy_set_header 覆盖 + 这里改优先级。
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
    const realIp = c.req.header('x-real-ip')
    if (realIp) return realIp.trim()

    const cfIp = c.req.header('cf-connecting-ip')
    if (cfIp) return cfIp.trim()

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
