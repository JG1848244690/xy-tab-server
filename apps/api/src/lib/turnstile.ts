/**
 * turnstile.ts —— Cloudflare Turnstile 真人验证(服务端校验)
 *
 * TURNSTILE_SECRET_KEY 留空 = 验证关闭(本地/测试直通,向后兼容);
 * 生产配上 key 后,register 必须带前端 widget 产出的 token。
 *
 * 前端 sitekey 走 apps/web 的 VITE_TURNSTILE_SITE_KEY。
 * 国内可达性:challenges.cloudflare.com 一般不被墙;真被墙再上自建图形码(backlog)。
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export function turnstileEnabled(): boolean {
    return Boolean(process.env.TURNSTILE_SECRET_KEY)
}

/**
 * 校验前端 token。任何失败(没配/没传/网络/CF 说不行)都返回 false,
 * 由调用方决定 403。
 */
export async function verifyTurnstile(token: string | undefined, remoteIp?: string): Promise<boolean> {
    if (!turnstileEnabled()) return true
    if (!token) return false

    try {
        const res = await fetch(VERIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret: process.env.TURNSTILE_SECRET_KEY,
                response: token,
                ...(remoteIp ? { remoteip: remoteIp } : {}),
            }),
            signal: AbortSignal.timeout(10_000),
        })
        if (!res.ok) return false
        const data = (await res.json()) as { success?: boolean }
        return data.success === true
    } catch {
        // CF 不可达:宁可拦下注册也不裸奔
        return false
    }
}
