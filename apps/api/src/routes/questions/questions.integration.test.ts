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
import { learningDays, questionAttempts, questionStats, questions, users } from '../../db/schema.js'
import { hashPassword } from '../../lib/auth.js'
import { learningDate, shiftLearningDate, startLearningWeek } from '../../lib/learning-days.js'
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
const ADMIN = {
    id: 'c0000000-0000-4000-8000-000000000003',
    email: 'admin@test.local',
    username: '管理员',
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
                { ...ADMIN, password: hash, role: 'admin' },
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

    it('首页和统计页的最近添加只列出对当前用户可见的已审核题', async () => {
        const shared = await createQuestion(OWNER, { title: '已通过' })
        await createQuestion(OWNER, { title: '他人私有题', visibility: 'private' })
        const waiting = await createQuestion(OWNER, { title: '等人工审核' })
        const rejected = await createQuestion(OWNER, { title: '人工拒绝' })
        await db.update(questions).set({ status: 'human_pending' }).where(eq(questions.id, waiting.id))
        await db.update(questions).set({ status: 'rejected' }).where(eq(questions.id, rejected.id))

        const dashboard = await req(app, OTHER, '/stats/dashboard')
        expect(dashboard.status).toBe(200)
        expect((await dashboard.json()).questions.recentAdded.map((row: { id: string }) => row.id)).toEqual([shared.id])

        const list = await req(app, OTHER, '/stats/recent-added-questions?page=1&size=10')
        expect(list.status).toBe(200)
        expect(await list.json()).toMatchObject({ total: 1, data: [{ id: shared.id }] })
    })

    it('完成练习自动打卡，周榜匿名自愿加入，退出后隐藏', async () => {
        await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, OWNER.id))
        await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, ADMIN.id))
        await db.update(users).set({ emailVerifiedAt: null }).where(eq(users.id, OTHER.id))
        const shared = await createQuestion(OWNER)
        const privateQuestion = await createQuestion(OWNER, { visibility: 'private' })
        const pending = await createQuestion(OWNER)
        await db.update(questions).set({ status: 'human_pending' }).where(eq(questions.id, pending.id))
        const today = learningDate()
        await db.insert(learningDays).values({ userId: OWNER.id, day: shiftLearningDate(today, -1) })

        const complete = (user: typeof OWNER, id: string, userAnswer = '我的解法') => req(app, user, `/questions/${id}/submit`, {
            method: 'POST', body: JSON.stringify({ userAnswer, completed: true }),
        })
        const optIn = (user: typeof OWNER, enabled: boolean) => req(app, user, '/stats/learning/leaderboard', {
            method: 'PUT', body: JSON.stringify({ enabled }),
        })
        const overview = async (user: typeof OWNER) => (await req(app, user, '/stats/learning')).json()

        expect((await complete(OWNER, shared.id, ' \n ')).status).toBe(422)
        expect((await complete(OTHER, pending.id)).status).toBe(404)
        const privateResult = await complete(OWNER, privateQuestion.id)
        expect(privateResult.status).toBe(200)
        expect(await privateResult.json()).not.toHaveProperty('checkIn')
        expect(await overview(OWNER)).toMatchObject({ enabled: false, myRank: null, streak: 1 })
        expect((await optIn(OTHER, true)).status).toBe(403)

        const repeats = await Promise.all([complete(OWNER, shared.id), complete(OWNER, shared.id)])
        expect(repeats.map((res) => res.status)).toEqual([200, 200])
        const responseBodies = await Promise.all(repeats.map((res) => res.json()))
        expect(responseBodies.flatMap((res) => res.checkIn ?? [])).toEqual([{ streak: 2 }])
        expect(await db.select().from(learningDays).where(eq(learningDays.userId, OWNER.id))).toHaveLength(2)
        const stats = await (await req(app, OWNER, '/stats/recent-completed-questions')).json()
        expect(stats).toMatchObject({ total: 2, data: expect.arrayContaining([
            expect.objectContaining({ id: shared.id, completedAt: expect.any(String), totalAttempts: 2 }),
        ]) })
        expect((await overview(OTHER)).leaderboard).toEqual([])

        if (startLearningWeek(today) !== today) {
            await db.insert(learningDays).values({ userId: ADMIN.id, day: shiftLearningDate(today, -1) })
        }
        expect((await complete(ADMIN, shared.id)).status).toBe(200)
        expect((await optIn(OWNER, true)).status).toBe(200)
        expect((await optIn(ADMIN, true)).status).toBe(200)
        const joined = await overview(OWNER)
        expect(joined).toMatchObject({ enabled: true, myRank: { rank: 1, isMe: true } })
        expect(joined.leaderboard.map((entry: { rank: number }) => entry.rank)).toEqual([1, 1])
        expect(joined.leaderboard.every((entry: object) => Object.keys(entry).sort().join(',') === 'alias,days,isMe,rank')).toBe(true)

        expect((await optIn(OWNER, false)).status).toBe(200)
        expect(await overview(OWNER)).toMatchObject({ enabled: false, myRank: null, streak: 2 })
        expect((await overview(OTHER)).leaderboard.map((entry: { alias: string }) => entry.alias)).not.toContain(joined.myRank.alias)
        expect((await optIn(OWNER, true)).status).toBe(200)
        expect((await overview(OWNER)).myRank.alias).toBe(joined.myRank.alias)
    })

    it('学习日和周榜在北京时间周一零点结算', () => {
        const sunday = learningDate(new Date('2026-11-22T15:59:59Z'))
        const monday = learningDate(new Date('2026-11-22T16:00:00Z'))
        expect([sunday, monday]).toEqual(['2026-11-22', '2026-11-23'])
        expect([startLearningWeek(sunday), startLearningWeek(monday)]).toEqual(['2026-11-16', '2026-11-23'])
    })

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

    it('列表默认带真实进度;status=incomplete 覆盖未开始+进行中', async () => {
        const doing = await createQuestion(OWNER, { title: '做了一半' })
        const done = await createQuestion(OWNER, { title: '做完了' })
        const untouched = await createQuestion(OWNER, { title: '没动' })

        await req(app, OTHER, `/questions/${doing.id}/submit`, {
            method: 'POST',
            body: JSON.stringify({ userAnswer: 'x', timeSpent: 3 }),
        })
        const submitted = await req(app, OTHER, `/questions/${done.id}/submit`, {
            method: 'POST',
            body: JSON.stringify({ userAnswer: '2', timeSpent: 4 }),
        })
        const { attempt } = (await submitted.json()) as { attempt: { id: string } }
        await req(app, OTHER, `/questions/${done.id}/attempts/${attempt.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ isCorrect: true }),
        })

        // 默认列表:不再一律 not_started / 0 次
        const list = (await (await req(app, OTHER, '/questions?size=20')).json()) as {
            data: { id: string; stats: { status: string; totalAttempts: number } }[]
        }
        const byId = Object.fromEntries(list.data.map((r) => [r.id, r.stats]))
        expect(byId[doing.id]).toMatchObject({ totalAttempts: 1, status: 'in_progress' })
        expect(byId[done.id]).toMatchObject({ status: 'completed' })
        expect(byId[untouched.id]).toMatchObject({ totalAttempts: 0, status: 'not_started' })

        // 未完成 = 未开始 + 进行中
        const inc = (await (await req(app, OTHER, '/questions?status=incomplete&size=20')).json()) as {
            data: { id: string }[]
        }
        const incIds = inc.data.map((r) => r.id)
        expect(incIds).toEqual(expect.arrayContaining([doing.id, untouched.id]))
        expect(incIds).not.toContain(done.id)

        const only = (await (await req(app, OTHER, '/questions?status=completed&size=20')).json()) as {
            data: { id: string }[]
        }
        expect(only.data.map((r) => r.id)).toEqual([done.id])
    })

    it('remove:普通用户只能撤回自己未过审的投稿;已过审/他人的一律 403', async () => {
        const pending = await createQuestion(OWNER, { title: '待撤回' })
        // createQuestion 默认落 approved(方便测列表),这里改回待审
        await db.update(questions).set({ status: 'human_pending' }).where(eq(questions.id, pending.id))
        const approved = await createQuestion(OWNER, { title: '已发布' })
        // 撤回时 stats / attempts 要跟着级联清掉
        await req(app, OTHER, `/questions/${pending.id}/submit`, {
            method: 'POST',
            body: JSON.stringify({ userAnswer: '2', timeSpent: 5 }),
        })

        // 本人撤回未过审 → 200
        const withdraw = await req(app, OWNER, `/questions/${pending.id}`, { method: 'DELETE' })
        expect(withdraw.status).toBe(200)
        expect(await db.select().from(questions).where(eq(questions.id, pending.id))).toHaveLength(0)
        expect(
            await db.select().from(questionStats).where(eq(questionStats.questionId, pending.id)),
        ).toHaveLength(0)
        expect(
            await db.select().from(questionAttempts).where(eq(questionAttempts.questionId, pending.id)),
        ).toHaveLength(0)

        // 本人删已过审 → 403(公开站上有链接,删了是死链)
        const delApproved = await req(app, OWNER, `/questions/${approved.id}`, { method: 'DELETE' })
        expect(delApproved.status).toBe(403)
        expect(await db.select().from(questions).where(eq(questions.id, approved.id))).toHaveLength(1)

        // 别人的投稿 → 403
        const otherPending = await createQuestion(OWNER, { title: '别人的' })
        const delOthers = await req(app, OTHER, `/questions/${otherPending.id}`, { method: 'DELETE' })
        expect(delOthers.status).toBe(403)

        // admin 删已过审 → 200
        const adminDel = await req(app, ADMIN, `/questions/${approved.id}`, { method: 'DELETE' })
        expect(adminDel.status).toBe(200)
    })

    it('create:普通用户每天最多 5 条,第 6 条 429;admin 不限', async () => {
        for (let i = 0; i < 5; i++) {
            await createQuestion(OWNER, { title: `配额题 ${i}` })
        }
        const sixth = await req(app, OWNER, '/questions', {
            method: 'POST',
            body: JSON.stringify({
                title: '第 6 条',
                type: 'text',
                content: 'x',
                answer: 'y',
                difficulty: 'easy',
            }),
        })
        expect(sixth.status).toBe(429)
        expect(((await sixth.json()) as { code: string }).code).toBe('SUBMIT_QUOTA_EXCEEDED')

        // admin 不受限
        const adminCreate = await req(app, ADMIN, '/questions', {
            method: 'POST',
            body: JSON.stringify({
                title: '管理员第 6 条',
                type: 'text',
                content: 'x',
                answer: 'y',
                difficulty: 'easy',
            }),
        })
        expect(adminCreate.status).toBe(200)
    })

    it('create:待审队列到 10 条后 429(PENDING_LIMIT)', async () => {
        // 直接入库,绕开每日配额,只压队列上限
        await db.insert(questions).values(
            Array.from({ length: 10 }, (_, i) => ({
                title: `排队题 ${i}`,
                type: 'text' as const,
                content: 'x',
                answer: 'y',
                difficulty: 'easy' as const,
                status: 'human_pending' as const,
                createdBy: OWNER.id,
            })),
        )

        const res = await req(app, OWNER, '/questions', {
            method: 'POST',
            body: JSON.stringify({
                title: '超出队列上限',
                type: 'text',
                content: 'x',
                answer: 'y',
                difficulty: 'easy',
            }),
        })
        expect(res.status).toBe(429)
        expect(((await res.json()) as { code: string }).code).toBe('PENDING_LIMIT')
    })

    it('GET /questions/submissions 只返回本人未过审的题', async () => {
        const mine = await createQuestion(OWNER, { title: '我的待审' })
        // 同上:createQuestion 默认 approved,这里改回待审
        await db.update(questions).set({ status: 'human_pending' }).where(eq(questions.id, mine.id))
        const approved = await createQuestion(OWNER, { title: '我的已过审' })
        await createQuestion(OTHER, { title: '别人的待审' })

        const res = await req(app, OWNER, '/questions/submissions')
        expect(res.status).toBe(200)
        const body = (await res.json()) as { data: { id: string; title: string }[] }
        const titles = body.data.map((x) => x.title)
        expect(titles).toContain('我的待审')
        expect(titles).not.toContain('我的已过审')
        expect(titles).not.toContain('别人的待审')
        expect(body.data.find((x) => x.id === mine.id)).toBeTruthy()
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

    it('update:普通用户 403(创建者也不行),admin 可改任意题', async () => {
        const shared = await createQuestion(OWNER, { title: '原标题' })

        // 非 admin → 403,题目未被改动
        const asOwner = await req(app, OWNER, `/questions/${shared.id}`, {
            method: 'PUT',
            body: JSON.stringify({ title: '被篡改' }),
        })
        expect(asOwner.status).toBe(403)

        const asOther = await req(app, OTHER, `/questions/${shared.id}`, {
            method: 'PUT',
            body: JSON.stringify({ title: '被篡改' }),
        })
        expect(asOther.status).toBe(403)

        expect(
            await db
                .select()
                .from(questions)
                .where(and(eq(questions.id, shared.id), eq(questions.title, '原标题'))),
        ).toHaveLength(1)

        // admin 改别人创建的题 → 200
        const asAdmin = await req(app, ADMIN, `/questions/${shared.id}`, {
            method: 'PUT',
            body: JSON.stringify({ title: '管理员改的标题' }),
        })
        expect(asAdmin.status).toBe(200)
        const [after] = await db.select().from(questions).where(eq(questions.id, shared.id))
        expect(after.title).toBe('管理员改的标题')
    })
})
