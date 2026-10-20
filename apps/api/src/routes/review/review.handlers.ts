import { and, desc, eq, inArray, lt, or, sql } from 'drizzle-orm'
import type {
    TriggerOneRoute,
    TriggerBatchRoute,
    ResultRoute,
    StaleRoute,
    QueueRoute,
    HumanDecisionRoute,
} from './review.routes.js'
import type { AppRouteHandler } from '../../lib/types.js'
import db from '../../db/index.js'
import { questions, reviewLogs } from '../../db/schema.js'
import { HttpStatusCodes } from '../../lib/openapi.js'
import { REVIEW_BATCH_MAX, REVIEW_STALE_MINUTES } from '../../lib/constants.js'
import { contentHashOf, runReview, isReviewing } from './agent.js'
import { llmConfigured } from './llm.js'
import { errorBody } from '../../lib/errors.js'
import { adminOnly } from '../../middlewares/admin.js'

/** 当前用户是不是 admin(后台工作台权限) */
const isAdmin = (c: { get: (k: 'userRole') => 'user' | 'admin' | undefined }) =>
    adminOnly(c)

/** 触发单题审核:仅创建者;幂等(内容没改且已过审 → skipped) */
export const triggerOne: AppRouteHandler<TriggerOneRoute> = async (c) => {
    const { id } = c.req.valid('param')
    const userId = c.get('userId')!

    // 归属校验放在 LLM 门禁之前:即使 agent 不可用,也不能让探测者
    // 借 503/404 的差异试探题目存在性
    const [q] = await db
        .select({
            createdBy: questions.createdBy,
            title: questions.title,
            content: questions.content,
            answer: questions.answer,
            contentHash: questions.contentHash,
            status: questions.status,
        })
        .from(questions)
        .where(eq(questions.id, id))
        .limit(1)
    // 非 owner 与不存在同响应,不泄露存在性(与题库 remove 同口径);
    // admin 例外:可以代为触发任意题的审核
    if (!q || (q.createdBy !== userId && !isAdmin(c))) {
        return c.json({ message: 'Not Found' }, HttpStatusCodes.NOT_FOUND)
    }

    if (!llmConfigured()) {
        return c.json(
            { message: 'LLM 未配置,审核 agent 不可用' },
            HttpStatusCodes.SERVICE_UNAVAILABLE,
        )
    }

    const hash = contentHashOf(q)

    // 同步可判定的 skip 场景直接应答(runReview 内部还有一道异步兜底):
    // 1. 内容没改且已人工通过 → 不重审不重发布
    if (q.contentHash === hash && q.status === 'approved') {
        return c.json({ status: 'skipped' as const }, HttpStatusCodes.OK)
    }
    // 2. 人工驳回后内容没改 → 必须先改内容才能重提
    const [humanReject] = await db
        .select({ contentHash: reviewLogs.contentHash })
        .from(reviewLogs)
        .where(
            and(
                eq(reviewLogs.questionId, id),
                eq(reviewLogs.source, 'human'),
                eq(reviewLogs.verdict, 'rejected'),
            ),
        )
        .orderBy(desc(reviewLogs.createdAt))
        .limit(1)
    if (humanReject && humanReject.contentHash === hash) {
        return c.json({ status: 'skipped' as const }, HttpStatusCodes.OK)
    }
    if (q.contentHash === hash && q.status === 'approved') {
        return c.json({ status: 'skipped' as const }, HttpStatusCodes.OK)
    }

    // 进程内异步,不阻塞请求;agent.runReview 永不 throw,这里再兜一层防呆
    if (!isReviewing(id)) {
        void runReview(id).catch((err) => {
            c.get('logger')?.error({ err, questionId: id }, 'review agent crashed')
        })
    }

    return c.json({ status: 'pending_review' as const }, HttpStatusCodes.OK)
}

/** 批量触发:清洗存量/补审用。候选 = 自己的题里 状态未过审 或 内容指纹缺失 的 */
export const triggerBatch: AppRouteHandler<TriggerBatchRoute> = async (c) => {
    const userId = c.get('userId')!
    const { limit } = c.req.valid('json')

    if (!llmConfigured()) {
        return c.json({ message: 'LLM 未配置,审核 agent 不可用' }, HttpStatusCodes.SERVICE_UNAVAILABLE)
    }

    const candidates = await db
        .select({ id: questions.id })
        .from(questions)
        .where(
            and(
                eq(questions.createdBy, userId),
                or(
                    sql`${questions.status} <> 'approved'`,
                    sql`${questions.contentHash} IS NULL`,
                ),
            ),
        )
        .orderBy(desc(questions.updatedAt))
        .limit(Math.min(limit, REVIEW_BATCH_MAX))

    let triggered = 0
    let skipped = 0
    await Promise.all(
        candidates.map(async ({ id }) => {
            if (isReviewing(id)) {
                skipped++
                return
            }
            triggered++
            void runReview(id).catch((err) => {
                c.get('logger')?.error({ err, questionId: id }, 'review agent crashed')
            })
        }),
    )

    return c.json({ triggered, skipped }, HttpStatusCodes.OK)
}

/** 轮询用:题目当前审核态 + 最近一次审计日志 */
export const result: AppRouteHandler<ResultRoute> = async (c) => {
    const { id } = c.req.valid('param')
    const userId = c.get('userId')!

    const [q] = await db
        .select({
            id: questions.id,
            title: questions.title,
            status: questions.status,
            reviewScore: questions.reviewScore,
            reviewResult: questions.reviewResult,
            contentHash: questions.contentHash,
            createdBy: questions.createdBy,
        })
        .from(questions)
        .where(eq(questions.id, id))
        .limit(1)
    if (!q || (q.createdBy !== userId && !isAdmin(c))) {
        return c.json({ message: 'Not Found' }, HttpStatusCodes.NOT_FOUND)
    }

    const [log] = await db
        .select({
            verdict: reviewLogs.verdict,
            score: reviewLogs.score,
            report: reviewLogs.report,
            latencyMs: reviewLogs.latencyMs,
            createdAt: reviewLogs.createdAt,
        })
        .from(reviewLogs)
        .where(eq(reviewLogs.questionId, id))
        .orderBy(desc(reviewLogs.createdAt))
        .limit(1)

    return c.json(
        {
            question: {
                id: q.id,
                title: q.title,
                status: q.status,
                reviewScore: q.reviewScore,
                reviewResult: q.reviewResult,
                contentHash: q.contentHash,
            },
            lastLog: log ?? null,
        },
        HttpStatusCodes.OK,
    )
}

// ============================================================
// 人工审核队列(admin only)
// ============================================================

/**
 * GET /review/queue?tab=pending|rejected
 *  - pending:AI 已完成且分数 ≥60,等人工裁决(human_pending)
 *  - rejected:被 AI 打回(带完整报告,创建者改内容后可重提)
 * AI 高置信(≥85)排前面 —— 但**不自动发布**,人工点通过才算。
 */
export const queue: AppRouteHandler<QueueRoute> = async (c) => {
    if (!isAdmin(c)) {
        return c.json(errorBody('Forbidden', 'FORBIDDEN'), HttpStatusCodes.FORBIDDEN)
    }
    const { tab, page, size } = c.req.valid('query')
    const status = tab === 'pending' ? 'human_pending' : 'rejected'

    const rows = await db
        .select({
            id: questions.id,
            title: questions.title,
            slug: questions.slug,
            status: questions.status,
            reviewScore: questions.reviewScore,
            reviewResult: questions.reviewResult,
            updatedAt: questions.updatedAt,
        })
        .from(questions)
        .where(eq(questions.status, status))
        .orderBy(
            tab === 'pending'
                ? sql`${questions.reviewScore} desc nulls last, ${questions.updatedAt} asc`
                : desc(questions.updatedAt),
        )
        .limit(size)
        .offset((page - 1) * size)

    const [{ value: total }] = await db
        .select({ value: sql<number>`count(*)` })
        .from(questions)
        .where(eq(questions.status, status))

    // 一次取回这些题的审计日志,内存里挑每题最新一条(避免 N+1)
    const ids = rows.map((r) => r.id)
    const logs = ids.length
        ? await db
              .select({
                  questionId: reviewLogs.questionId,
                  verdict: reviewLogs.verdict,
                  score: reviewLogs.score,
                  source: reviewLogs.source,
                  note: reviewLogs.note,
                  createdAt: reviewLogs.createdAt,
              })
              .from(reviewLogs)
              .where(inArray(reviewLogs.questionId, ids))
              .orderBy(desc(reviewLogs.createdAt))
        : []
    const latestByQuestion = new Map<string, (typeof logs)[number]>()
    for (const log of logs) {
        if (!latestByQuestion.has(log.questionId)) latestByQuestion.set(log.questionId, log)
    }

    return c.json(
        {
            data: rows.map((r) => ({
                ...r,
                latestLog: latestByQuestion.get(r.id) ?? null,
            })),
            total: Number(total),
            page,
            size,
        },
        HttpStatusCodes.OK,
    )
}

/**
 * POST /review/:id/human —— 人工裁决(admin only)
 *  - approve:status → approved,publishedAt 落值(公开站可见),落一条 source=human 日志
 *  - reject :status → rejected,理由必填(路由 schema 已强制),同样落日志
 */
export const humanDecision: AppRouteHandler<HumanDecisionRoute> = async (c) => {
    if (!isAdmin(c)) {
        return c.json(errorBody('Forbidden', 'FORBIDDEN'), HttpStatusCodes.FORBIDDEN)
    }
    const { id } = c.req.valid('param')
    const { decision, note } = c.req.valid('json')
    const reviewerId = c.get('userId')!

    const result = await db.transaction(async (tx) => {
        const [q] = await tx
            .select({
                id: questions.id,
                contentHash: questions.contentHash,
                reviewScore: questions.reviewScore,
                publishedAt: questions.publishedAt,
            })
            .from(questions)
            .where(eq(questions.id, id))
            .limit(1)
        if (!q) return null

        const nextStatus = decision === 'approve' ? 'approved' : 'rejected'
        const [updated] = await tx
            .update(questions)
            .set({
                status: nextStatus,
                // 通过即发布:publishedAt 首次落值后不再改(重审不重发)
                ...(decision === 'approve' ? { publishedAt: q.publishedAt ?? new Date() } : {}),
            })
            .where(eq(questions.id, id))
            .returning({
                status: questions.status,
                publishedAt: questions.publishedAt,
            })

        // 裁决与状态同事务:日志和状态必须同生共死
        await tx.insert(reviewLogs).values({
            questionId: id,
            contentHash: q.contentHash,
            verdict: nextStatus,
            score: q.reviewScore,
            source: 'human',
            reviewerId,
            note: note ?? null,
        })

        return updated
    })

    if (!result) {
        return c.json({ message: 'Not Found' }, HttpStatusCodes.NOT_FOUND)
    }
    return c.json(
        { success: true, status: result.status, publishedAt: result.publishedAt },
        HttpStatusCodes.OK,
    )
}

/**
 * 卡死兜底:pending_review 超过 30 分钟(进程重启丢内存队列的等价场景),
 * 列出来并自动重触发。供后台红 badge 与定时任务调用。
 */
export const stale: AppRouteHandler<StaleRoute> = async (c) => {
    const userId = c.get('userId')!

    const cutoff = sql`now() - ${`${REVIEW_STALE_MINUTES} minutes`}::interval`
    const staleRows = await db
        .select({
            id: questions.id,
            title: questions.title,
            updatedAt: questions.updatedAt,
        })
        .from(questions)
        .where(
            and(
                eq(questions.createdBy, userId),
                eq(questions.status, 'pending_review'),
                lt(questions.updatedAt, cutoff),
            ),
        )
        .limit(REVIEW_BATCH_MAX)

    let retriggered = 0
    for (const row of staleRows) {
        if (!isReviewing(row.id)) {
            void runReview(row.id).catch(() => {})
            retriggered++
        }
    }

    // inArray 空数组会生成 invalid SQL,空时直接返回
    return c.json(
        {
            stale: staleRows.length
                ? staleRows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updatedAt }))
                : [],
            retriggered,
        },
        HttpStatusCodes.OK,
    )
}
