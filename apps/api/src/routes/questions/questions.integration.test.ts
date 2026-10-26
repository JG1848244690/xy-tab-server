import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { and, eq } from 'drizzle-orm'
import app from '../../app.js'
import db, { client } from '../../db/index.js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import {
    MIGRATIONS_FOLDER,
    MIGRATIONS_SCHEMA,
    MIGRATIONS_TABLE,
} from '../../db/migrations-table.js'
import { questionAttempts, questionStats, questions, users } from '../../db/schema.js'
import { hashPassword } from '../../lib/auth.js'
import { truncateBusinessTables, req } from '../../test/helpers.js'

/**
 * questions 集成测试 —— 真实 PG + 完整 app(B21)
 *
 * 覆盖 mock 单测测不了的核心安全/正确性语义:
 *   - private 题可见性隔离(列表/详情/作答三条路径)
 *   - submit/markCorrect 事务后的统计一致性
 *   - 级联删除
 * 需要TEST_DATABASE_URL;没配自动跳过(见 vitest.setup.ts)。
 */
const hasDb = !!process.env.TEST_DATABASE_URL

const OWNER = {
    id: 'a0000000-0000-4000-8000-000000000001',
    email: 'owner@test.local',
    username: '出题人',
}
const OTHER = {
    id: 'b0000000-0000-4000-8000-000000000002',
    email: 'other@test.local',
    username: '做题人',
}

describe.skipIf(!hasDb)('questions integration (real PG)', () => {
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
        // 关掉本文件模块实例的连接池,否则 vitest 进程挂着不退
        await client.end({ timeout: 2 })
    })

    async function createQuestion(
        owner: typeof OWNER,
        body: Partial<{ title: string; visibility: 'shared' | 'private' }> = {},
    ) {
        const res = await req(app, owner, '/questions', {
            method: 'POST',
            body: JSON.stringify({
                title: body.title ?? '题目',
                type: 'text',
                content: '1+1=?',
                answer: '2',
                difficulty: 'easy',
                tags: ['math'],
                visibility: body.visibility ?? 'shared',
            }),
        })
        expect(res.status).toBe(200)
        const created = (await res.json()) as {
            id: string
            visibility: string
            createdBy: string
        }
        // 2026-10-26 起题库列表只显示已过审的题;这些用例检验的是"过审后的题库",
        // 直接落 approved(创建接口本身的 draft 语义由下面的用例单独覆盖)
        await db.update(questions).set({ status: 'approved' }).where(eq(questions.id, created.id))
        return created
    }

    it('private 题对非 owner 隔离:列表不含、详情 404、提交 404、且不泄露存在性', async () => {
        const shared = await createQuestion(OWNER, { title: '共享题' })
        const priv = await createQuestion(OWNER, { title: '私有题', visibility: 'private' })

        // 列表:B 只看得到 shared
        const listB = await (await req(app, OTHER, '/questions?size=100')).json()
        expect(listB.data.map((q: { id: string }) => q.id)).toContain(shared.id)
        expect(listB.data.map((q: { id: string }) => q.id)).not.toContain(priv.id)
        // 列表:A 都看得到
        const listA = await (await req(app, OWNER, '/questions?size=100')).json()
        expect(listA.data.map((q: { id: string }) => q.id)).toContain(priv.id)

        // 详情:B 404 且响应体只有 message/code,不区分"不存在"和"无权"
        const detailB = await req(app, OTHER, `/questions/${priv.id}`)
        expect(detailB.status).toBe(404)
        expect(await detailB.json()).toMatchObject({ message: 'Not Found' })
        const detailA = await req(app, OWNER, `/questions/${priv.id}`)
        expect(detailA.status).toBe(200)

        // 提交答案:B 不可练 private
        const submitB = await req(app, OTHER, `/questions/${priv.id}/submit`, {
            method: 'POST',
            body: JSON.stringify({ userAnswer: '2', timeSpent: 10 }),
        })
        expect(submitB.status).toBe(404)
    })

    it('列表:未过审的题只在审核中心(draft/rejected 不进题库);visibility 可筛选', async () => {
        // 未过审(draft):建完不该出现在题库列表
        const draftRes = await req(app, OWNER, '/questions', {
            method: 'POST',
            body: JSON.stringify({
                title: '还没过审的题',
                type: 'text',
                content: 'x',
                answer: 'y',
                difficulty: 'easy',
                visibility: 'shared',
            }),
        })
        const draft = (await draftRes.json()) as { id: string; status: string }
        expect(draft.status).toBe('draft')

        const shared = await createQuestion(OWNER, { title: '共享已过审' })
        const priv = await createQuestion(OWNER, { title: '私有已过审', visibility: 'private' })

        const all = await (await req(app, OWNER, '/questions?size=100')).json()
        const ids = all.data.map((q: { id: string }) => q.id)
        expect(ids).toContain(shared.id)
        expect(ids).toContain(priv.id)
        expect(ids).not.toContain(draft.id)

        const onlyPrivate = await (
            await req(app, OWNER, '/questions?size=100&visibility=private')
        ).json()
        expect(onlyPrivate.data.map((q: { id: string }) => q.id)).toEqual([priv.id])

        const onlyShared = await (
            await req(app, OWNER, '/questions?size=100&visibility=shared')
        ).json()
        expect(onlyShared.data.map((q: { id: string }) => q.id)).toEqual([shared.id])
    })

    it('详情:无统计记录时返回全字段兜底行,与表 schema 同形(B14)', async () => {
        const shared = await createQuestion(OWNER)
        const detail = await (await req(app, OTHER, `/questions/${shared.id}`)).json()
        expect(detail.stats).toEqual({
            userId: OTHER.id,
            questionId: shared.id,
            totalAttempts: 0,
            correctAttempts: 0,
            bestTime: null,
            firstCorrectAt: null,
            lastAttemptAt: null,
            status: 'not_started',
        })
    })

    it('submit:并发安全的自增计数,attemptCount 与 stats.totalAttempts 一致(B1)', async () => {
        const shared = await createQuestion(OWNER)

        const s1 = await req(app, OTHER, `/questions/${shared.id}/submit`, {
            method: 'POST',
            body: JSON.stringify({ userAnswer: '2', timeSpent: 30 }),
        })
        expect(s1.status).toBe(200)
        expect((await s1.json()).attempt.attemptCount).toBe(1)

        const s2 = await req(app, OTHER, `/questions/${shared.id}/submit`, {
            method: 'POST',
            body: JSON.stringify({ userAnswer: '3', timeSpent: 25 }),
        })
        expect((await s2.json()).attempt.attemptCount).toBe(2)

        // 事务一致性:流水 2 条,汇总 totalAttempts=2,状态停在 in_progress
        const stats = await db
            .select()
            .from(questionStats)
            .where(eq(questionStats.questionId, shared.id))
        expect(stats).toHaveLength(1)
        expect(stats[0].totalAttempts).toBe(2)
        expect(stats[0].status).toBe('in_progress')
        const attempts = await db
            .select()
            .from(questionAttempts)
            .where(eq(questionAttempts.questionId, shared.id))
        expect(attempts).toHaveLength(2)
    })

    it('markCorrect:判对推进 completed 并累加 correctAttempts;判错只改流水', async () => {
        const shared = await createQuestion(OWNER)
        const submit = await req(app, OTHER, `/questions/${shared.id}/submit`, {
            method: 'POST',
            body: JSON.stringify({ userAnswer: '2', timeSpent: 30 }),
        })
        const { attempt } = await submit.json()

        const wrong = await req(
            app,
            OTHER,
            `/questions/${shared.id}/attempts/${attempt.id}`,
            { method: 'PATCH', body: JSON.stringify({ isCorrect: false }) },
        )
        expect(wrong.status).toBe(200)
        expect((await wrong.json()).stats.status).toBe('in_progress')

        const right = await req(
            app,
            OTHER,
            `/questions/${shared.id}/attempts/${attempt.id}`,
            { method: 'PATCH', body: JSON.stringify({ isCorrect: true }) },
        )
        expect(right.status).toBe(200)
        const { stats } = await right.json()
        expect(stats).toMatchObject({
            totalAttempts: 1,
            correctAttempts: 1,
            status: 'completed',
        })
        expect(stats.firstCorrectAt).not.toBeNull()
        expect(stats.bestTime).toBe(30)

        const attemptRow = await db
            .select()
            .from(questionAttempts)
            .where(eq(questionAttempts.id, attempt.id))
        expect(attemptRow[0].isCorrect).toBe(true)
    })

    it('markCorrect:不能判别人的 attempt(404),也没改到任何东西', async () => {
        const shared = await createQuestion(OWNER)
        const submit = await req(app, OTHER, `/questions/${shared.id}/submit`, {
            method: 'POST',
            body: JSON.stringify({ userAnswer: '2', timeSpent: 30 }),
        })
        const { attempt } = await submit.json()

        // OWNER 试判 OTHER 的 attempt
        const res = await req(app, OWNER, `/questions/${shared.id}/attempts/${attempt.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ isCorrect: true }),
        })
        expect(res.status).toBe(404)

        const attemptRow = await db
            .select()
            .from(questionAttempts)
            .where(eq(questionAttempts.id, attempt.id))
        // is_correct 是 default(false) notNull:没被改动 = 仍是 false
        expect(attemptRow[0].isCorrect).toBe(false)
    })

    it('remove:只有 owner 能删;删除后 stats/attempts 级联清空', async () => {
        const shared = await createQuestion(OWNER, { title: '待删题' })
        await req(app, OTHER, `/questions/${shared.id}/submit`, {
            method: 'POST',
            body: JSON.stringify({ userAnswer: '2', timeSpent: 5 }),
        })

        // 非 owner 删 → 404
        const removeB = await req(app, OTHER, `/questions/${shared.id}`, { method: 'DELETE' })
        expect(removeB.status).toBe(404)

        // owner 删 → 200,级联生效
        const removeA = await req(app, OWNER, `/questions/${shared.id}`, { method: 'DELETE' })
        expect(removeA.status).toBe(200)
        expect(await db.select().from(questionStats).where(eq(questionStats.questionId, shared.id))).toHaveLength(0)
        expect(await db.select().from(questionAttempts).where(eq(questionAttempts.questionId, shared.id))).toHaveLength(0)
    })

    it('getStats:GROUP BY 聚合口径与流水一致(B4)', async () => {
        const shared = await createQuestion(OWNER)
        const s1 = await req(app, OTHER, `/questions/${shared.id}/submit`, {
            method: 'POST',
            body: JSON.stringify({ userAnswer: 'x', timeSpent: 10 }),
        })
        await req(app, OTHER, `/questions/${shared.id}/submit`, {
            method: 'POST',
            body: JSON.stringify({ userAnswer: '2', timeSpent: 20 }),
        })
        const { attempt } = await s1.json()
        await req(app, OTHER, `/questions/${shared.id}/attempts/${attempt.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ isCorrect: true }),
        })

        const res = await req(app, OTHER, '/questions/stats')
        expect(res.status).toBe(200)
        // OTHER 可见题库 = shared 这一道;两次提交,1 次判对
        expect(await res.json()).toMatchObject({
            total: 1,
            completed: 1,
            inProgress: 0,
            notStarted: 0,
            accuracy: 50,
        })
    })

    it('update:非 owner 修改返回 404,题目未被改动', async () => {
        const shared = await createQuestion(OWNER, { title: '原标题' })
        const res = await req(app, OTHER, `/questions/${shared.id}`, {
            method: 'PUT',
            body: JSON.stringify({ title: '被篡改' }),
        })
        expect(res.status).toBe(404)
        const row = await db
            .select()
            .from(questions)
            .where(and(eq(questions.id, shared.id), eq(questions.title, '原标题')))
        expect(row).toHaveLength(1)
    })
})
