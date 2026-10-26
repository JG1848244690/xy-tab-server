import { and, desc, eq, inArray, lt, or, sql } from 'drizzle-orm'
import type {
    TriggerOneRoute,
    TriggerBatchRoute,
    ResultRoute,
    StaleRoute,
    QueueRoute,
    GenerateRoute,
    ApplyRevisionRoute,
    HumanDecisionRoute,
    QuotaRoute,
} from './review.routes.js'
import type { AppRouteHandler } from '../../lib/types.js'
import db from '../../db/index.js'
import { questions, reviewLogs } from '../../db/schema.js'
import { HttpStatusCodes } from '../../lib/openapi.js'
import { LLM_JSON_RETRY, REVIEW_BATCH_MAX, REVIEW_STALE_MINUTES } from '../../lib/constants.js'
import { contentHashOf, runReview, isReviewing } from './agent.js'
import { llmConfigured, chatJsonWithRetry, generatedQuestionSchema } from './llm.js'
import { getQuota, consumeQuota } from './quota.js'
import { normalizeTags, popularTags } from './tags.js'
import { generateSystemPrompt } from './prompts/generate.js'
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

    // 配额:每用户每天 20 次,admin 豁免;按触发计(失败也是真实 LLM 成本)
    const admin = isAdmin(c)
    let quotaState: Awaited<ReturnType<typeof consumeQuota>> | null = null
    if (!admin) {
        quotaState = await consumeQuota(userId)
        if (quotaState.limited) {
            const retry = Math.ceil(
                (new Date(quotaState.resetAt).getTime() - Date.now()) / 1000,
            )
            c.header('Retry-After', String(retry))
            return c.json(
                errorBody(
                    `今日 AI 审核次数已用完(${quotaState.limit} 次),明天重置`,
                    'QUOTA_EXCEEDED',
                ),
                HttpStatusCodes.TOO_MANY_REQUESTS,
            )
        }
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

    return c.json(
        {
            status: 'pending_review' as const,
            ...(quotaState
                ? {
                      quota: {
                          used: quotaState.used,
                          limit: quotaState.limit,
                          remaining: quotaState.remaining,
                      },
                  }
                : {}),
        },
        HttpStatusCodes.OK,
    )
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
    // 配额按题数扣:admin 豁免;普通用户扣到上限就停,多余的算 skipped
    let quotaState: Awaited<ReturnType<typeof consumeQuota>> | null = null
    for (const { id } of candidates) {
        if (isReviewing(id)) {
            skipped++
            continue
        }
        if (!isAdmin(c)) {
            quotaState = await consumeQuota(userId)
            if (quotaState.limited) {
                skipped++
                continue
            }
        }
        triggered++
        void runReview(id).catch((err) => {
            c.get('logger')?.error({ err, questionId: id }, 'review agent crashed')
        })
    }

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
 * GET /review/queue?status=all|reviewing|pending|rejected|approved
 * 单列表(2026-10-26 起替代四 tab):
 *  - 每行用四步进度展示:AI 审核中 → AI 审核通过 → 待人工审核 → 已通过
 *  - 排序:待人工 > 审核中 > 未通过 > 已通过,同组按最近更新
 *  - counts 给筛选按钮上的数字
 */
export const queue: AppRouteHandler<QueueRoute> = async (c) => {
    if (!isAdmin(c)) {
        return c.json(errorBody('Forbidden', 'FORBIDDEN'), HttpStatusCodes.FORBIDDEN)
    }
    const { status: statusFilter, page, size } = c.req.valid('query')
    const statusByFilter = {
        reviewing: 'pending_review',
        pending: 'human_pending',
        rejected: 'rejected',
        approved: 'approved',
    } as const
    const where =
        statusFilter === 'all'
            ? undefined
            : eq(questions.status, statusByFilter[statusFilter])

    const rows = await db
        .select({
            id: questions.id,
            title: questions.title,
            slug: questions.slug,
            status: questions.status,
            reviewScore: questions.reviewScore,
            reviewResult: questions.reviewResult,
            content: questions.content,
            answer: questions.answer,
            tags: questions.tags,
            updatedAt: questions.updatedAt,
        })
        .from(questions)
        .where(where)
        .orderBy(
            // 工作台优先级:待人工 > 审核中 > 未通过 > 已通过
            sql`case ${questions.status}
                when 'human_pending' then 0
                when 'pending_review' then 1
                when 'rejected' then 2
                else 3
            end`,
            desc(questions.updatedAt),
        )
        .limit(size)
        .offset((page - 1) * size)

    const [{ value: total }] = await db
        .select({ value: sql<number>`count(*)` })
        .from(questions)
        .where(where)

    // 各状态计数:一次 GROUP BY 拿全,筛选按钮直接显示数字
    const statusRows = await db
        .select({ status: questions.status, value: sql<number>`count(*)` })
        .from(questions)
        .groupBy(questions.status)
    const counts = { all: 0, reviewing: 0, pending: 0, rejected: 0, approved: 0 }
    for (const row of statusRows) {
        const n = Number(row.value)
        counts.all += n
        if (row.status === 'pending_review') counts.reviewing += n
        else if (row.status === 'human_pending') counts.pending += n
        else if (row.status === 'rejected') counts.rejected += n
        else if (row.status === 'approved') counts.approved += n
    }

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
            counts,
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
 * POST /review/generate —— AI 自动出题(登录用户可用,扣 AI 配额)
 *
 * 用户把知识点 / 文档片段 / AI 回答粘进来,生成一道完整题目(不落库)。
 * 前端可以选择「填进表单再编辑」或「生成并直接提交审核」——
 * 落库仍走 POST /questions,保持「创建即自动送审」的唯一入口。
 */
export const generate: AppRouteHandler<GenerateRoute> = async (c) => {
    const userId = c.get('userId')!
    const { source, type, difficulty } = c.req.valid('json')

    if (!llmConfigured()) {
        return c.json({ message: 'LLM 未配置,审核 agent 不可用' }, HttpStatusCodes.SERVICE_UNAVAILABLE)
    }

    // 生成也是真实 LLM 成本:和审核共用每日配额(admin 豁免)
    let quotaState: Awaited<ReturnType<typeof consumeQuota>> | null = null
    if (!isAdmin(c)) {
        quotaState = await consumeQuota(userId)
        if (quotaState.limited) {
            const retry = Math.ceil(
                (new Date(quotaState.resetAt).getTime() - Date.now()) / 1000,
            )
            c.header('Retry-After', String(retry))
            return c.json(
                errorBody(
                    `今日 AI 审核次数已用完(${quotaState.limit} 次),明天重置`,
                    'QUOTA_EXCEEDED',
                ),
                HttpStatusCodes.TOO_MANY_REQUESTS,
            )
        }
    }

    const candidates = await popularTags()
    const hints = [
        type ? `【指定题型】${type}(必须遵守)` : '',
        difficulty ? `【指定难度】${difficulty}(必须遵守)` : '',
        `【平台已有标签(优先复用)】${candidates.join('、') || '无'}`,
    ]
        .filter(Boolean)
        .join('\n')

    try {
        const { report } = await chatJsonWithRetry(
            [
                { role: 'system' as const, content: generateSystemPrompt },
                { role: 'user' as const, content: `${hints}\n\n【用户粘贴的内容】\n${source}` },
            ],
            generatedQuestionSchema,
            LLM_JSON_RETRY,
        )

        return c.json(
            {
                question: {
                    ...report,
                    // 标签统一收敛(别名/去重/最多 4 个);题型与难度以用户指定为准
                    tags: normalizeTags(report.tags),
                    type: type ?? report.type,
                    difficulty: difficulty ?? report.difficulty,
                },
                ...(quotaState
                    ? {
                          quota: {
                              used: quotaState.used,
                              limit: quotaState.limit,
                              remaining: quotaState.remaining,
                          },
                      }
                    : {}),
            },
            HttpStatusCodes.OK,
        )
    } catch (err) {
        c.get('logger')?.error({ err, userId }, 'ai generate question failed')
        return c.json(
            { message: 'AI 生成失败,请稍后重试' },
            HttpStatusCodes.SERVICE_UNAVAILABLE,
        )
    }
}

/**
 * POST /review/:id/apply-revision —— 一键应用 AI 改进版(admin 或创建者)
 *
 * AI 打回时(见 prompts/output.ts)会给出可直接落库的完整版本
 * (题干/答案/标签)。这里把 revised 写回**原题**(不新建),然后立即
 * 在原题上重触发审核 —— 用户交互 = 「让 AI 改好 → 再走一遍流程」。
 */
export const applyRevision: AppRouteHandler<ApplyRevisionRoute> = async (c) => {
    const { id } = c.req.valid('param')
    const userId = c.get('userId')!

    if (!llmConfigured()) {
        return c.json({ message: 'LLM 未配置,审核 agent 不可用' }, HttpStatusCodes.SERVICE_UNAVAILABLE)
    }

    const [q] = await db
        .select({
            createdBy: questions.createdBy,
            title: questions.title,
            status: questions.status,
            contentHash: questions.contentHash,
        })
        .from(questions)
        .where(eq(questions.id, id))
        .limit(1)
    if (!q || (q.createdBy !== userId && !isAdmin(c))) {
        return c.json({ message: 'Not Found' }, HttpStatusCodes.NOT_FOUND)
    }

    // 取最近一次 AI 报告的 revised;老报告没有该字段 → 404(前端也不该展示按钮)
    const [log] = await db
        .select({ report: reviewLogs.report })
        .from(reviewLogs)
        .where(and(eq(reviewLogs.questionId, id), eq(reviewLogs.source, 'ai')))
        .orderBy(desc(reviewLogs.createdAt))
        .limit(1)

    const revised = (log?.report as Record<string, unknown> | null | undefined)?.revised as
        | { title?: unknown; content?: unknown; answer?: unknown; tags?: unknown }
        | undefined
    if (
        !revised ||
        typeof revised.content !== 'string' ||
        !revised.content.trim() ||
        typeof revised.answer !== 'string' ||
        !revised.answer.trim()
    ) {
        return c.json({ message: 'Not Found' }, HttpStatusCodes.NOT_FOUND)
    }

    const updates: {
        title?: string
        content: string
        answer: string
        tags?: string[]
    } = {
        content: revised.content,
        answer: revised.answer,
    }
    if (typeof revised.title === 'string' && revised.title.trim()) {
        updates.title = revised.title.trim().slice(0, 255)
    }
    // 与审核/出题共用同一套标签收敛规则
    const tags = normalizeTags(revised.tags)
    if (tags.length) updates.tags = tags

    // 原题就地更新(不新建):内容变了 → contentHash 不匹配 → 重审必然执行。
    // 配额先扣:额度用尽时不应留下"改了内容却没送审"的中间态
    let quotaState: Awaited<ReturnType<typeof consumeQuota>> | null = null
    if (!isAdmin(c)) {
        quotaState = await consumeQuota(userId)
        if (quotaState.limited) {
            const retry = Math.ceil(
                (new Date(quotaState.resetAt).getTime() - Date.now()) / 1000,
            )
            c.header('Retry-After', String(retry))
            return c.json(
                errorBody(
                    `今日 AI 审核次数已用完(${quotaState.limit} 次),明天重置`,
                    'QUOTA_EXCEEDED',
                ),
                HttpStatusCodes.TOO_MANY_REQUESTS,
            )
        }
    }

    await db.update(questions).set(updates).where(eq(questions.id, id))

    // agent 正忙则只写回不重复排队
    const busy = isReviewing(id)
    if (!busy) {
        void runReview(id).catch((err) => {
            c.get('logger')?.error({ err, questionId: id }, 'review agent crashed')
        })
    }

    return c.json(
        {
            applied: true,
            status: 'pending_review',
            queued: !busy,
            ...(quotaState
                ? {
                      quota: {
                          used: quotaState.used,
                          limit: quotaState.limit,
                          remaining: quotaState.remaining,
                      },
                  }
                : {}),
        },
        HttpStatusCodes.OK,
    )
}

/** 配额查询:出题人随时可看自己今天的用量(admin 显示豁免) */
export const quota: AppRouteHandler<QuotaRoute> = async (c) => {
    const userId = c.get('userId')!
    if (isAdmin(c)) {
        return c.json(
            {
                used: 0,
                limit: 0,
                remaining: 0,
                limited: false,
                resetAt: '',
                exempt: true,
            },
            HttpStatusCodes.OK,
        )
    }
    const state = await getQuota(userId)
    return c.json({ ...state, exempt: false }, HttpStatusCodes.OK)
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
