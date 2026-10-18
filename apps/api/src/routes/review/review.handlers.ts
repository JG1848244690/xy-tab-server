import { and, desc, eq, lt, or, sql } from 'drizzle-orm'
import type {
    TriggerOneRoute,
    TriggerBatchRoute,
    ResultRoute,
    StaleRoute,
} from './review.routes.js'
import type { AppRouteHandler } from '../../lib/types.js'
import db from '../../db/index.js'
import { questions, reviewLogs } from '../../db/schema.js'
import { HttpStatusCodes } from '../../lib/openapi.js'
import { REVIEW_BATCH_MAX, REVIEW_STALE_MINUTES } from '../../lib/constants.js'
import { contentHashOf, runReview, isReviewing } from './agent.js'
import { llmConfigured } from './llm.js'

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
    // 非 owner 与不存在同响应,不泄露存在性(与题库 remove 同口径)
    if (!q || q.createdBy !== userId) {
        return c.json({ message: 'Not Found' }, HttpStatusCodes.NOT_FOUND)
    }

    if (!llmConfigured()) {
        return c.json(
            { message: 'LLM 未配置,审核 agent 不可用' },
            HttpStatusCodes.SERVICE_UNAVAILABLE,
        )
    }

    const hash = contentHashOf(q)
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
    if (!q || q.createdBy !== userId) {
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
