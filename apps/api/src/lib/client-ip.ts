/**
 * client-ip.ts —— 客户端真实 IP 的统一出口(防滥用系列共用水源)
 *
 * 取值规则(2026-11-13 安全加固后):
 *   x-real-ip → cf-connecting-ip → TCP 对端
 *
 * 为什么 x-real-ip 排第一:app 只绑 127.0.0.1(见 docker-compose),
 * 外网只能经 nginx 进来,而 nginx 会用 `$remote_addr` 覆盖这两个头。
 * 若继续优先信 cf-connecting-ip,客户端自带同名头就能每次换一个「IP」,
 * 限流形同虚设(已实测:换个头就从 429 恢复 200)。
 *
 * ipHash:sha256 + 固定盐后截断 32 位 —— 防滥用判定用,不存裸 IP
 * (库泄露时也还原不出真实 IP)。
 */
import { createHash } from 'node:crypto'
import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context } from 'hono'

export function clientIp(c: Context): string {
    // nginx 写的,可信(客户端伪造的同名头会被 proxy_set_header 覆盖)
    const realIp = c.req.header('x-real-ip')
    if (realIp) return realIp.trim()

    // 兼容不走 nginx 的场景(本地直连 / 未来接 CF);nginx 在时它已被覆盖
    const cf = c.req.header('cf-connecting-ip')
    if (cf) return cf.trim()

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
