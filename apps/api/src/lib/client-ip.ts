/**
 * client-ip.ts —— 客户端真实 IP 的统一出口(防滥用系列共用水源)
 *
 * 取值规则与限流中间件一致(docs/abuse-defense-plan.md):
 *   cf-connecting-ip(CF 边缘强制覆盖,伪造不了)→ x-real-ip → TCP 对端
 *
 * ipHash:sha256 + 固定盐后截断 32 位 —— 防滥用判定用,不存裸 IP
 * (库泄露时也还原不出真实 IP)。
 */
import { createHash } from 'node:crypto'
import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context } from 'hono'

export function clientIp(c: Context): string {
    const cf = c.req.header('cf-connecting-ip')
    if (cf) return cf.trim()

    const realIp = c.req.header('x-real-ip')
    if (realIp) return realIp.trim()

    // 本地 dev 直连:取 TCP 对端。测试(app.request)没有底层连接 → 'unknown'
    try {
        return getConnInfo(c)?.remote?.address ?? 'unknown'
    } catch {
        return 'unknown'
    }
}

/** 注册频控用的 IP 指纹;VIEW_SALT 不同用途不同盐,互不可逆推 */
export function ipHashOf(ip: string, salt = 'register'): string {
    return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}
