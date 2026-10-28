import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import db, { client } from '../../db/index.js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import {
    MIGRATIONS_FOLDER,
    MIGRATIONS_SCHEMA,
    MIGRATIONS_TABLE,
} from '../../db/migrations-table.js'
import { aiQuota, questions, reviewLogs, users } from '../../db/schema.js'
import { hashPassword } from '../../lib/auth.js'
import { truncateBusinessTables, req } from '../../test/helpers.js'

/**
 * 审核工作流 admin 集成测试(2026-10-20:人工审核强制,AI 只做前置)
 *
 * LLM 用 mock 的 global fetch:返回可控分数,验证完整状态机 ——
 *   AI 高分 → human_pending(不是 approved!)+ 进人工队列
 *   AI 低分 → rejected(打回,有记录)
 *   人工通过 → approved + publishedAt;人工驳回 → 带理由的日志
 *
 * LLM env 必须在 import 模块之前就位(env.ts 在 import 时 parse),
 * 所以这里全部动态 import。
 */
const hasDb = !!process.env.TEST_DATABASE_URL

const ADMIN = {
    id: 'a1000000-0000-4000-8000-000000000001',
    email: 'workflow-admin@test.local',
    username: '管理员',
}
const CREATOR = {
    id: 'a1000000-0000-4000-8000-000000000002',
    email: 'workflow-creator@test.local',
    username: '出题人',
}

/** 构造 LLM 的假响应:总分 = 五维之和(zod 契约要求) */
function llmReport(total: number) {
    const each = Math.round((total / 5) * 10) / 10
    const dims = {
        correctness: each,
        completeness: each,
        clarity: each,
        originality: each,
        relevance: each,
    }
    return {
        choices: [
            {
                message: {
                    content: JSON.stringify({
                        dimensions: dims,
                        total,
                        summary: '这是一条测试摘要,长度超过五个字。',
                        tags: ['测试标签'],
                        suggestions: ['建议一'],
                        oneLiner: '一句话答案',
                        mnemonic: '测试口诀',
                    }),
                },
            },
        ],
    }
}

/** 等 agent 的异步审核落库(void 触发,轮询等结果) */
async function waitForStatus(questionId: string, status: string, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        const [row] = await db
            .select({ status: questions.status })
            .from(questions)
            .where(eq(questions.id, questionId))
            .limit(1)
        if (row?.status === status) return true
        await new Promise((r) => setTimeout(r, 100))
    }
    return false
}

describe.skipIf(!hasDb)('review admin workflow (real PG + mock LLM)', () => {
    let app: typeof import('../../app.js').default

    beforeAll(async () => {
        // LLM env 必须先于模块 import 就位(env.ts 在 import 时 parse)
        process.env.LLM_BASE_URL = 'http://mock-llm.local'
        process.env.LLM_MODEL = 'test-model'
        process.env.LLM_API_KEY = 'test-key'
        ;({ default: app } = await import('../../app.js'))

        await migrate(db, {
            migrationsFolder: MIGRATIONS_FOLDER,
            migrationsTable: MIGRATIONS_TABLE,
            migrationsSchema: MIGRATIONS_SCHEMA,
        })
        const hash = await hashPassword('password123')
        await db
            .insert(users)
            .values([
                { ...ADMIN, password: hash, role: 'admin' as const },
                { ...CREATOR, password: hash, role: 'user' as const },
            ])
            .onConflictDoNothing()
    })

    beforeEach(async () => {
        await truncateBusinessTables(db)
        // 配额按天累计:每个用例从 0 开始,断言才有意义
        await db.delete(aiQuota)
        // mock LLM:默认给 90 分(高置信,但仍是 human_pending)
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(JSON.stringify(llmReport(90)), { status: 200 })),
        )
    })

    afterAll(async () => {
        vi.unstubAllGlobals()
        await client.end({ timeout: 2 })
    })

    async function seedQuestion(over: Partial<typeof questions.$inferInsert> = {}) {
        const [row] = await db
            .insert(questions)
            .values({
                title: '工作流测试题',
                type: 'text',
                content: '题干',
                answer: '答案',
                difficulty: 'easy',
                // 公开站按 slug 读,默认给一个唯一的
                slug: `wf-${Math.random().toString(36).slice(2, 10)}`,
                createdBy: CREATOR.id,
                ...over,
            })
            .returning()
        return row!
    }

    it('AI 高分(90)→ human_pending 而非 approved;进人工队列;非 admin 看 queue 403', async () => {
        const q = await seedQuestion({})
        const trigger = await req(app, CREATOR, `/review/${q.id}`, { method: 'POST' })
        expect(trigger.status).toBe(200)

        expect(await waitForStatus(q.id, 'human_pending')).toBe(true)

        // 非 admin:403
        const forbidden = await req(app, CREATOR, '/review/queue')
        expect(forbidden.status).toBe(403)

        // admin:队列里有人,分数 90,且状态不是 approved
        const queue = await req(app, ADMIN, '/review/queue?status=pending')
        expect(queue.status).toBe(200)
        const body = await queue.json()
        expect(body.total).toBe(1)
        expect(body.data[0].id).toBe(q.id)
        expect(body.data[0].reviewScore).toBe(90)
        expect(body.data[0].status).toBe('human_pending')
        expect(body.data[0].latestLog.source).toBe('ai')
    })

    it('人工通过 → approved + publishedAt 落值 + 审计日志(source=human)', async () => {
        const q = await seedQuestion({})
        await req(app, CREATOR, `/review/${q.id}`, { method: 'POST' })
        await waitForStatus(q.id, 'human_pending')

        const res = await req(app, ADMIN, `/review/${q.id}/human`, {
            method: 'POST',
            body: JSON.stringify({ decision: 'approve' }),
        })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.status).toBe('approved')
        expect(body.publishedAt).not.toBeNull()

        // 公开站可见
        const pub = await app.request(`/public/questions/${q.slug}`)
        expect(pub.status).toBe(200)
    })

    it('人工驳回必须带理由;驳回后同内容重触发 → skipped(必须先改内容)', async () => {
        const q = await seedQuestion({})
        await req(app, CREATOR, `/review/${q.id}`, { method: 'POST' })
        await waitForStatus(q.id, 'human_pending')

        // 不带理由 → 422
        const noNote = await req(app, ADMIN, `/review/${q.id}/human`, {
            method: 'POST',
            body: JSON.stringify({ decision: 'reject' }),
        })
        expect(noNote.status).toBe(422)

        // 带理由 → rejected + 日志有 note
        const res = await req(app, ADMIN, `/review/${q.id}/human`, {
            method: 'POST',
            body: JSON.stringify({ decision: 'reject', note: '答案太薄,补分层' }),
        })
        expect(res.status).toBe(200)
        expect((await res.json()).status).toBe('rejected')

        // 同内容重触发 → skipped(人工驳回后必须改内容)
        const retrig = await req(app, CREATOR, `/review/${q.id}`, { method: 'POST' })
        expect((await retrig.json()).status).toBe('skipped')
    })

    it('AI 低分(40)→ rejected(AI 打回),rejected tab 可见且带报告', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(JSON.stringify(llmReport(40)), { status: 200 })),
        )
        const q = await seedQuestion({})
        await req(app, CREATOR, `/review/${q.id}`, { method: 'POST' })
        expect(await waitForStatus(q.id, 'rejected')).toBe(true)

        const queue = await req(app, ADMIN, '/review/queue?status=rejected')
        expect(queue.status).toBe(200)
        const body = await queue.json()
        expect(body.total).toBe(1)
        expect(body.data[0].reviewScore).toBe(40)
        expect(body.data[0].latestLog.verdict).toBe('rejected')
        expect(body.data[0].latestLog.source).toBe('ai')
        // AI 报告里带修改建议(打回记录完整)
        expect(body.data[0].reviewResult.suggestions).toBeDefined()

        // 打回的题公开站不可见
        const pub = await app.request(`/public/questions/${q.slug}`)
        expect(pub.status).toBe(404)
    })

    it('审核中 tab:可见 pending_review 的题(非 admin 403)', async () => {
        const q = await seedQuestion({ status: 'pending_review' })

        const queue = await req(app, ADMIN, '/review/queue?status=reviewing')
        expect(queue.status).toBe(200)
        const body = await queue.json()
        expect(body.total).toBe(1)
        expect(body.data[0].id).toBe(q.id)

        const forbidden = await req(app, CREATOR, '/review/queue?status=reviewing')
        expect(forbidden.status).toBe(403)
    })

    it('队列单列表:status=all 返回全部 + 各状态计数 + 待人工优先排序', async () => {
        const pending = await seedQuestion({ status: 'human_pending', reviewScore: 80 })
        const rejected = await seedQuestion({ status: 'rejected', reviewScore: 30 })
        const approved = await seedQuestion({ status: 'approved', reviewScore: 90 })
        // 已过审的题不再出现在单列表的待办里,但仍要出现在 status=approved 下
        const res = await req(app, ADMIN, '/review/queue?status=all')
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.counts).toEqual({
            all: 3,
            reviewing: 0,
            pending: 1,
            rejected: 1,
            approved: 1,
        })
        expect(body.data.map((q: { id: string }) => q.id)).toEqual([
            pending.id,
            rejected.id,
            approved.id,
        ])
    })

    it('一键应用 AI 改进版:写回原题(标题/题干/答案/标签)并自动重审', async () => {
        // 本用例的重审报告不带 tags:否则 agent 会按既有语义用新报告覆盖标签,
        // 就验证不到「应用修订时写入了标签」
        const report = llmReport(90)
        const payload = JSON.parse(report.choices[0].message.content as string)
        delete payload.tags
        report.choices[0].message.content = JSON.stringify(payload)
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(JSON.stringify(report), { status: 200 })),
        )

        const q = await seedQuestion({ status: 'rejected', reviewScore: 40 })
        // 模拟 AI 打回报告:带可直接落库的 revised
        await db.insert(reviewLogs).values({
            questionId: q.id,
            contentHash: null,
            verdict: 'rejected',
            score: 40,
            source: 'ai',
            report: {
                dimensions: {
                    correctness: 8,
                    completeness: 8,
                    clarity: 8,
                    originality: 8,
                    relevance: 8,
                },
                total: 40,
                summary: '答案太薄,补充分层与代码示例。',
                suggestions: ['补充边界条件'],
                revised: {
                    title: '改进后的标题',
                    content: '改进后的题干(带代码块)',
                    answer: '改进后的答案(结论→原理→边界)',
                    tags: ['改进标签'],
                },
            },
        })

        const res = await req(app, ADMIN, `/review/${q.id}/apply-revision`, { method: 'POST' })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.applied).toBe(true)
        expect(body.queued).toBe(true)

        // 内容已写回原题(不新建),重审也跑完了
        expect(await waitForStatus(q.id, 'human_pending')).toBe(true)
        const [row] = await db.select().from(questions).where(eq(questions.id, q.id))
        expect(row!.title).toBe('改进后的标题')
        expect(row!.content).toBe('改进后的题干(带代码块)')
        expect(row!.answer).toBe('改进后的答案(结论→原理→边界)')
        // 三级标签会并进 tags;旧标签「改进标签」必须保留
        expect(row!.tags).toContain('改进标签')
        expect(row!.direction).toBe('前端')
        expect(row!.techStack).toBe('JavaScript')
        expect(row!.knowledgePoints?.length).toBeGreaterThan(0)
        expect(row!.reviewScore).toBe(90)
    })

    it('AI 报告内嵌 ```js 代码块时仍能正确解析(围栏误伤回归)', async () => {
        const report = llmReport(40)
        const payload = JSON.parse(report.choices[0].message.content as string)
        payload.revised = {
            content: '请手写 Promise.all,并说明失败行为。',
            answer: '结论:任一失败立即 reject。\n\n```js\nfunction promiseAll(list) {\n  return new Promise((resolve) => resolve(list))\n}\n```',
            tags: ['Promise'],
        }
        report.choices[0].message.content = JSON.stringify(payload)
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(JSON.stringify(report), { status: 200 })),
        )

        const q = await seedQuestion({})
        await req(app, CREATOR, `/review/${q.id}`, { method: 'POST' })
        expect(await waitForStatus(q.id, 'rejected')).toBe(true)

        const [row] = await db.select().from(questions).where(eq(questions.id, q.id))
        const revised = (row!.reviewResult as { revised?: { answer?: string } }).revised
        expect(revised?.answer).toContain('```js')
    })

    it('最近一次 AI 报告没有改进版 → apply-revision 404', async () => {
        const q = await seedQuestion({ status: 'rejected' })
        await db.insert(reviewLogs).values({
            questionId: q.id,
            contentHash: null,
            verdict: 'rejected',
            score: 30,
            source: 'ai',
            report: { total: 30, summary: '没有 revised 的老报告' },
        })
        const res = await req(app, ADMIN, `/review/${q.id}/apply-revision`, { method: 'POST' })
        expect(res.status).toBe(404)
    })

    it('模型返回空 revised(空字符串)时视为没有改进版,审核正常完成', async () => {
        const report = llmReport(80)
        const payload = JSON.parse(report.choices[0].message.content as string)
        payload.revised = { title: '', content: '', answer: '', tags: [] }
        report.choices[0].message.content = JSON.stringify(payload)
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(JSON.stringify(report), { status: 200 })),
        )

        const q = await seedQuestion({})
        await req(app, CREATOR, `/review/${q.id}`, { method: 'POST' })
        // 不再因为空 revised 整次失败:状态正常进入 human_pending
        expect(await waitForStatus(q.id, 'human_pending')).toBe(true)

        const [row] = await db.select().from(questions).where(eq(questions.id, q.id))
        const revised = (row!.reviewResult as { revised?: unknown }).revised
        expect(revised).toBeUndefined()
    })

    it('AI 自动出题:草稿→核查→终稿三步,按原文生成并归一标签', async () => {
        const question = {
            title: '事件循环中微任务与宏任务的执行顺序',
            content: '给出代码,判断输出顺序并解释原因。',
            answer: '结论:同步代码 → 微任务 → 宏任务。',
            tags: ['js', 'JavaScript', '事件循环', '微任务', '宏任务', '事件循环机制'],
            difficulty: 'medium',
            type: 'text',
        }
        const llmReply = (content: unknown) => ({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: 0,
            model: 'deepseek-flash',
            choices: [
                {
                    index: 0,
                    message: { role: 'assistant', content: JSON.stringify(content) },
                    finish_reason: 'stop',
                },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        })

        const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
            const body = JSON.parse(String(init?.body ?? '{}')) as {
                messages?: Array<{ role?: string; content?: unknown }>
            }
            const promptText = JSON.stringify(body.messages ?? [])
            let content: unknown
            if (promptText.includes('事实核查员')) {
                content = {
                    verdict: 'revise',
                    issues: [
                        {
                            severity: 'warning',
                            kind: 'unsupported',
                            detail: '草稿补充了原文没有的宏任务细节',
                            fix: '按原文收窄,或在 caveats 提示核实',
                        },
                    ],
                    needsResearch: false,
                    researchQueries: [],
                    sourceCoverage: 'partial',
                }
            } else if (promptText.includes('终稿编辑')) {
                content = {
                    ...question,
                    grounded: true,
                    caveats: ['原文只覆盖了微任务,宏任务细节建议人工核对。'],
                }
            } else {
                content = question
            }
            return new Response(JSON.stringify(llmReply(content)), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        const res = await req(app, CREATOR, '/review/generate', {
            method: 'POST',
            body: JSON.stringify({
                source: '微任务在当前宏任务结束后、下一个宏任务开始前清空队列;Promise.then 属于微任务。',
            }),
        })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.question.title).toContain('事件循环')
        // js → JavaScript 与 JavaScript 去重;事件循环机制 → 事件循环;
        // 词表里已有标签时最多只保留 1 个新建标签(具体数量取决于词表,单测另测)
        expect(body.question.tags).toEqual(
            expect.arrayContaining(['JavaScript', '事件循环']),
        )
        expect(body.question.tags.length).toBeLessThanOrEqual(16)
        expect(new Set(body.question.tags.map((t: string) => t.toLowerCase())).size).toBe(
            body.question.tags.length,
        )
        // 三级标签:方向/技术栈/知识点必须一起返回
        expect(body.question.direction).toBeTruthy()
        expect(body.question.techStack).toBeTruthy()
        expect(Array.isArray(body.question.knowledgePoints)).toBe(true)
        // 三步都真的调用了模型;核查意见里的不确定点透传给前端
        expect(fetchMock).toHaveBeenCalledTimes(3)
        expect(body.meta.steps).toBe(3)
        expect(body.caveats).toEqual(['原文只覆盖了微任务,宏任务细节建议人工核对。'])

        // 生成也是 LLM 成本:消耗 1 次配额
        const quota = await (await req(app, CREATOR, '/review/quota')).json()
        expect(quota.used).toBe(1)
    })

    it('AI 自动出题:source 太短 → 422', async () => {
        const res = await req(app, CREATOR, '/review/generate', {
            method: 'POST',
            body: JSON.stringify({ source: '太短' }),
        })
        expect(res.status).toBe(422)
    })

    it('admin 可代触发任意题;普通用户看别人的题仍 404', async () => {
        const q = await seedQuestion({ createdBy: ADMIN.id })
        // CREATOR 触发 ADMIN 的题 → 404
        const forbidden = await req(app, CREATOR, `/review/${q.id}`, { method: 'POST' })
        expect(forbidden.status).toBe(404)
        // admin 自己(或代触)→ 走流程
        const res = await req(app, ADMIN, `/review/${q.id}`, { method: 'POST' })
        expect(res.status).toBe(200)
        expect(await waitForStatus(q.id, 'human_pending')).toBe(true)
    })
})
