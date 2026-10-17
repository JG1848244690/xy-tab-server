import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import app from '../../app.js'
import db, { client } from '../../db/index.js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import {
    MIGRATIONS_FOLDER,
    MIGRATIONS_SCHEMA,
    MIGRATIONS_TABLE,
} from '../../db/migrations-table.js'
import { users } from '../../db/schema.js'

/**
 * auth 集成测试:走真实 PG,验证唯一索引兜底(B2)与登录回路。
 * mock 单测(auth.test.ts)测契约形状,这里测数据库真行为。
 */
const hasDb = !!process.env.TEST_DATABASE_URL

const EMAIL = 'auth-int@test.local'

describe.skipIf(!hasDb)('auth integration (real PG)', () => {
    beforeAll(async () => {
        await migrate(db, {
            migrationsFolder: MIGRATIONS_FOLDER,
            migrationsTable: MIGRATIONS_TABLE,
            migrationsSchema: MIGRATIONS_SCHEMA,
        })
        // 测试库是持久的:清掉上次运行留下的同名账号,保证可重复跑
        await db.delete(users).where(eq(users.email, EMAIL))
    })

    afterAll(async () => {
        await client.end({ timeout: 2 })
    })

    it('register:同一邮箱重复注册,第二次 409(唯一索引兜底,不再是 500)', async () => {
        const first = await app.request('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: EMAIL, password: 'pw123456', name: '首次' }),
        })
        expect(first.status).toBe(200)
        expect((await first.json()).name).toBe('首次')

        const second = await app.request('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: EMAIL, password: 'pw123456', name: '重复' }),
        })
        expect(second.status).toBe(409)
        const body = await second.json()
        expect(body.message).toBe('User already exists')
        expect(body.code).toBe('CONFLICT')
        // 统一错误体:只有 message + code,不携带任何内部信息
        expect(Object.keys(body).sort()).toEqual(['code', 'message'])
    })

    it('login → me:真实 bcrypt 校验 + HttpOnly Cookie 回路', async () => {
        const login = await app.request('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: EMAIL, password: 'pw123456' }),
        })
        expect(login.status).toBe(200)
        const cookie = login.headers.get('set-cookie')!.split(';')[0]
        expect(cookie).toContain(`${process.env.AUTH_COOKIE_NAME ?? 'Authentication'}=`)

        const me = await app.request('/auth/me', {
            headers: { Cookie: cookie },
        })
        expect(me.status).toBe(200)
        expect((await me.json()).email).toBe(EMAIL)
    })
})
