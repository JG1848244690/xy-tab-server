import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import db, { client } from '../db/index.js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import {
    MIGRATIONS_FOLDER,
    MIGRATIONS_SCHEMA,
    MIGRATIONS_TABLE,
} from '../db/migrations-table.js'
import { questions, users, aiQuota } from '../db/schema.js'
import { hashPassword } from '../lib/auth.js'
import { truncateBusinessTables, req } from './helpers.js'

/**
 * 防滥用集成测试(docs/abuse-defense-plan.md)
 *   - AI 配额:20 次/天,第 21 次 429;quota 接口可见;admin 豁免
 *   - 注册:同 IP 24h 最多 2 个号,第 3 个 403;TURNSTILE 未配时直通
 *
 * LLM env 在 import 前注入(同 review-admin 测试的做法)。
 */
const hasDb = !!process.env.TEST_DATABASE_URL

const USER = {
    id: 'c2000000-0000-4000-8000-000000000001',
    email: 'quota-user@test.local',
    username: '配额体验员',
}
const ADMIN = {
    id: 'c2000000-0000-4000-8000-000000000002',
    email: 'quota-admin@test.local',
    username: '管理员',
}

let app: typeof import('../app.js').default

function llmReport(total: number) {
    const each = Math.round((total / 5) * 10) / 10
    return {
        choices: [
            {
                message: {
                    content: JSON.stringify({
                        dimensions: {
                            correctness: each,
                            completeness: each,
                            clarity: each,
                            originality: each,
                            relevance: each,
                        },
                        total,
                        summary: '这是一条测试摘要,长度超过五个字。',
                    }),
                },
            },
        ],
    }
}

async function seedQuestion(creatorId: string) {
    const [row] = await db
        .insert(questions)
        .values({
            title: `配额测试题 ${Math.random().toString(36).slice(2, 8)}`,
            type: 'text',
            content: '题干',
            answer: '答案',
            difficulty: 'easy',
            slug: `qq-${Math.random().toString(36).slice(2, 10)}`,
            createdBy: creatorId,
        })
        .returning()
    return row!
}

/** 连接池整个文件只关一次(每个 describe 各关一次的话,第二个 describe 全挂) */
afterAll(async () => {
    await client.end({ timeout: 2 })
})

describe.skipIf(!hasDb)('abuse defense: AI quota', () => {
    beforeAll(async () => {
        process.env.LLM_BASE_URL = 'http://mock-llm.local'
        process.env.LLM_MODEL = 'test-model'
        process.env.LLM_API_KEY = 'test-key'
        process.env.TURNSTILE_SECRET_KEY = ''
        ;({ default: app } = await import('../app.js'))

        await migrate(db, {
            migrationsFolder: MIGRATIONS_FOLDER,
            migrationsTable: MIGRATIONS_TABLE,
            migrationsSchema: MIGRATIONS_SCHEMA,
        })
        const hash = await hashPassword('password123')
        await db
            .insert(users)
            .values([
                { ...USER, password: hash, role: 'user' as const },
                { ...ADMIN, password: hash, role: 'admin' as const },
            ])
            .onConflictDoNothing()
    })

    beforeEach(async () => {
        await truncateBusinessTables(db)
        await db.delete(aiQuota)
        // 每次触发都成功(高分,只测配额计数)
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(JSON.stringify(llmReport(75)), { status: 200 })),
        )
    })

    afterAll(async () => {
        vi.unstubAllGlobals()
    })

    it('触发 20 次都在配额内,第 21 次 429 QUOTA_EXCEEDED', async () => {
        for (let i = 1; i <= 20; i++) {
            const q = await seedQuestion(USER.id)
            const res = await req(app, USER, `/review/${q.id}`, { method: 'POST' })
            expect(res.status).toBe(200)
        }

        // 第 21 次:先建题再触发 → 429
        const q21 = await seedQuestion(USER.id)
        const over = await req(app, USER, `/review/${q21.id}`, { method: 'POST' })
        expect(over.status).toBe(429)
        const body = await over.json()
        expect(body.code).toBe('QUOTA_EXCEEDED')
        expect(body.message).toContain('20')
    })

    it('GET /review/quota 用户可见 used/limit/remaining', async () => {
        const q = await seedQuestion(USER.id)
        await req(app, USER, `/review/${q.id}`, { method: 'POST' })

        const res = await req(app, USER, '/review/quota')
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.used).toBe(1)
        expect(body.limit).toBe(20)
        expect(body.remaining).toBe(19)
        expect(body.exempt).toBe(false)
    })

    it('admin 豁免:触发不消耗配额,quota 显示 exempt', async () => {
        const q = await seedQuestion(ADMIN.id)
        const res = await req(app, ADMIN, `/review/${q.id}`, { method: 'POST' })
        expect(res.status).toBe(200)

        const quotaRes = await req(app, ADMIN, '/review/quota')
        const quota = await quotaRes.json()
        expect(quota.exempt).toBe(true)
        expect(quota.used).toBe(0)
    })

    it('创建题目自动送审并消耗配额;配额尽后创建仍成功(题停 draft)', async () => {
        // 连建 21 题:前 20 题触发 AI,第 21 题配额尽但创建照常成功
        for (let i = 0; i < 21; i++) {
            const res = await req(app, USER, '/questions', {
                method: 'POST',
                body: JSON.stringify({
                    title: `自动送审题 ${i}`,
                    type: 'text',
                    content: '内容',
                    answer: '答案',
                    difficulty: 'easy',
                }),
            })
            expect(res.status).toBe(200)
        }

        // 21 题都建成了;但 2026-10-26 起题库列表只显示已过审的题,
        // 这批还停在审核中心,所以直接按库里的行数断言
        const rows = await db
            .select({ id: questions.id })
            .from(questions)
            .where(eq(questions.createdBy, USER.id))
        expect(rows).toHaveLength(21)
        const l1 = await (await req(app, USER, '/questions?size=50')).json()
        expect(l1.total).toBe(0)
    })
})

describe.skipIf(!hasDb)('abuse defense: register IP limits', () => {
    beforeAll(async () => {
        process.env.LLM_BASE_URL = ''
        process.env.LLM_MODEL = ''
        process.env.LLM_API_KEY = ''
        process.env.TURNSTILE_SECRET_KEY = ''
        ;({ default: app } = await import('../app.js'))
        await migrate(db, {
            migrationsFolder: MIGRATIONS_FOLDER,
            migrationsTable: MIGRATIONS_TABLE,
            migrationsSchema: MIGRATIONS_SCHEMA,
        })
    })

    function register(email: string, ip?: string) {
        return app.request('/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(ip ? { 'cf-connecting-ip': ip } : {}),
            },
            body: JSON.stringify({ email, password: 'pw123456', name: '测' }),
        })
    }

    it('同 IP 当天第 3 个账号 → 403 REGISTER_LIMIT;换 IP 不受影响', async () => {
        // 清掉可能的同名邮箱(测试库持久)与该 IP 的历史
        // 注意:邮箱命名带 ip- 前缀,避免撞别的测试文件的 fixture 用户
        for (const e of ['ip-a@test.local', 'ip-b@test.local', 'ip-c@test.local', 'ip-other@test.local']) {
            await db.delete(users).where(eq(users.email, e))
        }
        // 203.0.99.1 的 hash:复用 lib 同款算法清历史
        const { ipHashOf } = await import('../lib/client-ip.js')
        await db.delete(users).where(eq(users.createdIpHash, ipHashOf('203.0.99.1')))

        expect((await register('ip-a@test.local', '203.0.99.1')).status).toBe(200)
        expect((await register('ip-b@test.local', '203.0.99.1')).status).toBe(200)
        const third = await register('ip-c@test.local', '203.0.99.1')
        expect(third.status).toBe(403)
        expect((await third.json()).code).toBe('REGISTER_LIMIT')

        // 换 IP 照常
        expect((await register('ip-other@test.local', '203.0.99.2')).status).toBe(200)
    })
})
