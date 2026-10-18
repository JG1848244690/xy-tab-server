import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import app from '../../app.js'
import db, { client } from '../../db/index.js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import {
    MIGRATIONS_FOLDER,
    MIGRATIONS_SCHEMA,
    MIGRATIONS_TABLE,
} from '../../db/migrations-table.js'
import { questions, users } from '../../db/schema.js'
import { hashPassword } from '../../lib/auth.js'
import { truncateBusinessTables, req } from '../../test/helpers.js'

/**
 * review 模块集成测试(面试站 P0,plan §2.3)
 *
 * LLM 真实调用不进测试(成本+不稳定):这里覆盖无 LLM key 的确定性路径
 * —— 503 门禁、创建者校验、幂等语义、卡死检测接口。
 * agent 的 LLM 链路上线后用真实 key 在 staging 环境验收。
 */
const hasDb = !!process.env.TEST_DATABASE_URL

const OWNER = {
    id: 'f0000000-0000-4000-8000-000000000001',
    email: 'review-owner@test.local',
    username: '出题人',
}
const OTHER = {
    id: 'f0000000-0000-4000-8000-000000000002',
    email: 'review-other@test.local',
    username: '路人',
}

async function seedQuestion(over: Partial<typeof questions.$inferInsert>) {
    const [row] = await db
        .insert(questions)
        .values({
            title: '审核目标题',
            type: 'text',
            content: '题干',
            answer: '答案',
            difficulty: 'easy',
            createdBy: OWNER.id,
            ...over,
        })
        .returning()
    return row!
}

describe.skipIf(!hasDb)('review module integration (real PG)', () => {
    beforeAll(async () => {
        await migrate(db, {
            migrationsFolder: MIGRATIONS_FOLDER,
            migrationsTable: MIGRATIONS_TABLE,
            migrationsSchema: MIGRATIONS_SCHEMA,
        })
        const hash = await hashPassword('password123')
        await db
            .insert(users)
            .values([
                { ...OWNER, password: hash },
                { ...OTHER, password: hash },
            ])
            .onConflictDoNothing()
    })

    beforeEach(async () => {
        await truncateBusinessTables(db)
    })

    afterAll(async () => {
        await client.end({ timeout: 2 })
    })

    it('LLM 未配置时:触发 503(明确报 agent 不可用,而非静默失败)', async () => {
        const q = await seedQuestion({})
        const res = await req(app, OWNER, `/review/${q.id}`, { method: 'POST' })
        expect(res.status).toBe(503)
        expect((await res.json()).message).toContain('LLM')
    })

    it('非创建者触发 → 404,不泄露存在性', async () => {
        const q = await seedQuestion({})
        const res = await req(app, OTHER, `/review/${q.id}`, { method: 'POST' })
        expect(res.status).toBe(404)
    })

    it('result:创建者可查当前审核态;lastLog 为空时给 null', async () => {
        const q = await seedQuestion({ status: 'pending_review' })
        const res = await req(app, OWNER, `/review/${q.id}/result`)
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.question.status).toBe('pending_review')
        expect(body.lastLog).toBeNull()
        // 铁律:响应里没有别人该看的归属字段
        expect(body.question.createdBy).toBeUndefined()
    })

    it('stale:pending_review 未超时不在列,created_by 隔离', async () => {
        await seedQuestion({ status: 'pending_review' })
        // OTHER 名下没有 pending_review 题
        const res = await req(app, OTHER, '/review/stale')
        expect(res.status).toBe(200)
        expect((await res.json()).stale).toHaveLength(0)
    })

    it('result:非创建者查别人的题 → 404', async () => {
        const q = await seedQuestion({ status: 'approved' })
        const res = await req(app, OTHER, `/review/${q.id}/result`)
        expect(res.status).toBe(404)
    })
})
