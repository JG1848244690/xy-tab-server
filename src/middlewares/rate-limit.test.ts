import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { rateLimit } from './rate-limit.js'

/**
 * 限流中间件单测(B5 的 key 规则与窗口行为)。
 * 注意:buckets 是模块级共享的,key 里带请求路径,每个用例用独立路径互不干扰。
 */
describe('rateLimit middleware', () => {
    beforeEach(() => {
        // 本文件自建 Hono 实例,不走 app.ts 的挂载,无需清理全局桶:
        // 用例之间用不同 path 隔离
    })

    function makeApp(path: string, max: number) {
        const app = new Hono()
        app.use(path, rateLimit({ windowMs: 60_000, max }))
        app.post(path, (c) => c.json({ ok: true }))
        return app
    }

    it('窗口内超过 max 次 → 429,且带 Retry-After', async () => {
        const app = makeApp('/limit-1', 2)
        const opts = { method: 'POST' } as const

        expect((await app.request('/limit-1', opts)).status).toBe(200)
        expect((await app.request('/limit-1', opts)).status).toBe(200)

        const third = await app.request('/limit-1', opts)
        expect(third.status).toBe(429)
        expect(third.headers.get('Retry-After')).toBeTruthy()
        expect(await third.json()).toMatchObject({ code: 'RATE_LIMITED' })
    })

    it('cf-connecting-ip 相同 → 同一桶;不同 → 独立桶(伪造头够不到 app 的前提由端口绑定保证)', async () => {
        const app = makeApp('/limit-2', 1)
        const post = (ip: string) =>
            app.request('/limit-2', { method: 'POST', headers: { 'cf-connecting-ip': ip } })

        // victim 连打两次:第二次被限
        expect((await post('1.1.1.1')).status).toBe(200)
        expect((await post('1.1.1.1')).status).toBe(429)

        // attacker 自己的桶不受影响,也不会把 1.1.1.1 的计数推高
        expect((await post('2.2.2.2')).status).toBe(200)
        expect((await post('1.1.1.1')).status).toBe(429)
    })

    it('没有专属 IP 头的请求(测试里无底层连接)共享 unknown 桶,连续超限仍会被挡', async () => {
        const app = makeApp('/limit-3', 1)
        expect((await app.request('/limit-3', { method: 'POST' })).status).toBe(200)
        expect((await app.request('/limit-3', { method: 'POST' })).status).toBe(429)
    })
})
