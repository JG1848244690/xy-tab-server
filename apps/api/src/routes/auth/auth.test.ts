import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * mock 的可变返回值。必须用 vi.hoisted 提到模块顶层 ——
 * 从 '../../db/index.js' import { state } 会在 tsc 阶段报 TS2614:
 * 真实模块并没有这个导出,它只在 mock 工厂里存在。
 */
const { state } = vi.hoisted(() => ({
    state: {
        /** select().from().where().limit() 的返回值 */
        selectResult: [] as unknown[],
        /** insert().values().returning() 的返回值 */
        insertResult: [] as unknown[],
    },
}))

/**
 * db 完全 mock 掉:测试不连真实 Postgres,CI 跑得干净。
 * 路径要和 auth.handlers.ts 里的 import 完全一致(含 .js 后缀)。
 */
vi.mock('../../db/index.js', () => ({
    default: {
        select: () => {
            const chain: Record<string, unknown> = {}
            chain.from = () => chain
            chain.where = () => chain
            chain.orderBy = () => chain
            chain.limit = () => Promise.resolve(state.selectResult)
            // count 聚合查询不调 .limit() 直接 await —— 链本身要可 then
            chain.then = (resolve: (v: unknown) => unknown) =>
                Promise.resolve(state.selectResult).then(resolve)
            return chain
        },
        insert: () => {
            const chain: Record<string, unknown> = {}
            chain.values = () => chain
            // register 现在用 onConflictDoNothing + returning 判冲突(B2)
            chain.onConflictDoNothing = () => chain
            chain.returning = () => Promise.resolve(state.insertResult)
            return chain
        },
        update: () => {
            const chain: Record<string, unknown> = {}
            chain.set = () => chain
            chain.where = () => chain
            chain.returning = () => Promise.resolve(state.insertResult)
            return chain
        },
    },
}))

import { Hono } from 'hono'
import { cookieAuth } from '../../middlewares/auth.js'
import { signToken } from '../../lib/auth.js'
import env from '../../env.js'
import auth from './auth.index.js'

const EXISTING_USER = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'a@test.com',
    // bcrypt(cost 10) 的 'pw123456' —— 必须是真实 hash,
    // 编一个假的过不了 verifyPassword,登录用例就会误报 401
    password: '$2b$10$XmgFPBda9w3ZoMcjwCOCVOORG7pFtsmv7Kw0YZUVgG2jmpQLJuiQC',
    username: '测试员',
    avatarPath: null,
    createdAt: new Date(),
    updatedAt: new Date(),
}

beforeEach(() => {
    state.selectResult = []
    state.insertResult = []
})

describe('auth contract', () => {
    const app = new Hono()
    app.route('/', auth)

    it('POST /auth/register 返回前端需要的 name 字段(不是 username)', async () => {
        // 注册不再先查后插(B2),insert + onConflictDoNothing 一步到位
        state.insertResult = [{ ...EXISTING_USER, email: 'new@test.com', username: '新用户' }]

        const res = await app.request('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'new@test.com', password: 'pw123456', name: '新用户' }),
        })

        expect(res.status).toBe(200)
        const body = await res.json()
        // 旧 Nest 的 register 明确把 username 映射成 name,前端 layout 依赖它
        expect(body.name).toBe('新用户')
        expect(body).not.toHaveProperty('password')
    })

    it('POST /auth/register 邮箱已存在时 409(唯一索引兜底,returning 为空)', async () => {
        state.insertResult = []

        const res = await app.request('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'a@test.com', password: 'pw123456', name: 'x' }),
        })

        expect(res.status).toBe(409)
        const body = await res.json()
        expect(body.code).toBe('CONFLICT')
    })

    it('POST /auth/login 下发 HttpOnly 的 Authentication Cookie', async () => {
        state.selectResult = [EXISTING_USER]

        const res = await app.request('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'a@test.com', password: 'pw123456' }),
        })

        expect(res.status).toBe(200)
        const setCookie = res.headers.getSetCookie().join(';')
        expect(setCookie).toContain(`${env.AUTH_COOKIE_NAME}=`)
        expect(setCookie).toContain('HttpOnly')
        expect(setCookie).toContain('Path=/')
        expect(setCookie).toContain('SameSite=Lax')

        const body = await res.json()
        expect(body.user.name).toBe('测试员')
    })

    it('POST /auth/login 邮箱不存在与密码错误都是 401(不区分)', async () => {
        state.selectResult = []
        const noSuchUser = await app.request('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'nobody@test.com', password: 'pw123456' }),
        })
        expect(noSuchUser.status).toBe(401)

        state.selectResult = [{ ...EXISTING_USER, password: '$2b$10$nottherightoneAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }]
        const badPassword = await app.request('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'a@test.com', password: 'wrong-password' }),
        })
        expect(badPassword.status).toBe(401)
    })

    it('POST /auth/logout 下发删除 Cookie 的指令', async () => {
        const res = await app.request('/auth/logout', { method: 'POST' })
        expect(res.status).toBe(200)

        const setCookie = res.headers.getSetCookie().join(';')
        // 必须和 setAuthCookie 用同一个 path,否则浏览器删不掉
        expect(setCookie).toContain(`${env.AUTH_COOKIE_NAME}=`)
        expect(setCookie).toContain('Max-Age=0')
        expect(setCookie).toContain('Path=/')
    })
})

describe('cookieAuth middleware', () => {
    const app = new Hono()
    app.use('/auth/me', cookieAuth())
    app.route('/', auth)

    it('没有 Cookie 时 401', async () => {
        const res = await app.request('/auth/me')
        expect(res.status).toBe(401)
    })

    it('签名无效 / 被篡改的 token 401', async () => {
        for (const token of ['garbage', 'a.b.c', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.bad-signature']) {
            const res = await app.request('/auth/me', {
                headers: { Cookie: `${env.AUTH_COOKIE_NAME}=${token}` },
            })
            expect(res.status).toBe(401)
        }
    })

    it('token 有效但用户已不存在时 401', async () => {
        const token = await signToken(EXISTING_USER.id, EXISTING_USER.email)
        state.selectResult = [] // 中间件查库没查到

        const res = await app.request('/auth/me', {
            headers: { Cookie: `${env.AUTH_COOKIE_NAME}=${token}` },
        })
        expect(res.status).toBe(401)
    })

    it('token 有效且用户存在时放行,并把 name 字段带给前端', async () => {
        const token = await signToken(EXISTING_USER.id, EXISTING_USER.email)
        state.selectResult = [EXISTING_USER]

        const res = await app.request('/auth/me', {
            headers: { Cookie: `${env.AUTH_COOKIE_NAME}=${token}` },
        })

        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.id).toBe(EXISTING_USER.id)
        expect(body.name).toBe('测试员')
        expect(body).not.toHaveProperty('password')
    })
})
