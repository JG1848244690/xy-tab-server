import { and, asc, count, desc, eq, ilike, isNull, ne, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type {
    ListRoute,
    MySubmissionsRoute,
    GetOneRoute,
    CreateRoute,
    UpdateRoute,
    RemoveRoute,
    SubmitRoute,
    MarkCorrectRoute,
    GetAttemptsRoute,
    GetStatsRoute,
} from './questions.routes.js'
import type { AppRouteHandler } from '../../lib/types.js'
import db from '../../db/index.js'
import { detectQuestionType } from '../../lib/question-type.js'
import { resolveBankId } from '../../lib/question-bank.js'
import { aiReviewDisabled } from '../review/llm.js'
import {
    questionAttempts,
    questionStats,
    questions,
    selectQuestionsSchema,
} from '../../db/schema.js'
import { HttpStatusCodes } from '../../lib/openapi.js'
import { errorBody } from '../../lib/errors.js'
import {
    consumeSubmitQuota,
    countPendingSubmissions,
    QUESTION_PENDING_LIMIT,
} from './submit-quota.js'
import { runReview, isReviewing } from '../review/agent.js'
import { consumeQuota } from '../review/quota.js'
import { classifyQuestion } from './taxonomy.js'

// ============================================================
// 列表
// ============================================================

/** question_stats.status 的三种取值,与 pgEnum question_status 对齐 */
type QuestionStatus = 'not_started' | 'in_progress' | 'completed'

/** 没有统计记录时给前端的兜底值,与旧 Nest 代码一致 */
const EMPTY_STATS = {
    totalAttempts: 0,
    correctAttempts: 0,
    status: 'not_started' as const,
    lastAttemptAt: null,
}

/**
 * 可见范围:shared 人人可见;private 仅 owner。
 * 列表 / 详情 / 作答 / 统计的题库口径统一用它(signature 见 docs/db-ownership-hardening.md §4)
 */
const visibleBank = (userId: string) =>
    or(eq(questions.visibility, 'shared'), eq(questions.createdBy, userId))!

/**
 * 题库列表口径(2026-10-26 起):只显示**已过审**的题。
 * 新提交的题先留在审核中心(draft/pending_review/rejected),
 * 人工通过后才出现在题库 —— 与后台工作台的职责边界一致。
 */
const approvedBank = (userId: string) =>
    and(visibleBank(userId), eq(questions.status, 'approved'))!

export const list: AppRouteHandler<ListRoute> = async (c) => {
    const userId = c.get('userId')!
    const {
        type,
        difficulty,
        visibility,
        tag,
        direction,
        stack,
        point,
        status,
        page,
        size,
        ordering,
        search,
    } = c.req.valid('query')

    // 可见性 + 过审永远第一位;后面再叠加业务过滤
    const conditions = [approvedBank(userId)]
    if (visibility) conditions.push(eq(questions.visibility, visibility))
    if (type) conditions.push(eq(questions.type, type))
    if (difficulty) conditions.push(eq(questions.difficulty, difficulty))
    if (search) conditions.push(ilike(questions.title, `%${search}%`))
    // MySQL 的 JSON_CONTAINS(q.tags, '"x"') → PG jsonb 包含操作符 @>
    if (tag) conditions.push(sql`${questions.tags} @> ${JSON.stringify([tag])}::jsonb`)
    if (direction) conditions.push(eq(questions.direction, direction))
    if (stack) conditions.push(eq(questions.techStack, stack))
    if (point) conditions.push(sql`${questions.knowledgePoints} @> ${JSON.stringify([point])}::jsonb`)

    // 带别名的 question_stats 副本 —— select / orderBy / where 一律引用它。
    // 用原表名 questionStats 会被 PG 判成 42P01(undefined table)
    const stat = alias(questionStats, 'stat')

    /**
     * 列表永远 join question_stats。
     *
     * 之前只在「按状态筛选 / 按 stats 排序」时才 join,导致默认视图里
     * 每道题都是「未开始 · 0 次」—— 用户根本看不出自己刷到哪了。
     * LEFT JOIN 命中的是 (user_id, question_id) 主键,代价可以忽略。
     */
    if (status === 'incomplete') {
        // 未完成 = 未开始 + 进行中(没有 stats 行的题算未开始)
        conditions.push(
            or(
                eq(stat.status, 'not_started'),
                eq(stat.status, 'in_progress'),
                isNull(stat.questionId),
            )!,
        )
    } else if (status === 'not_started') {
        conditions.push(or(eq(stat.status, 'not_started'), isNull(stat.questionId))!)
    } else if (status) {
        conditions.push(eq(stat.status, status))
    }

    const where = conditions.length ? and(...conditions) : undefined

    // join 条件固定带上 userId,否则会串到别人的行
    // 列引用必须用 stat:PG 里表一旦被 AS 别名,原表名在同一 FROM 子句内就不可见了
    // (MySQL 允许,这里不 —— 用原表名会 42P01)
    const joinOn = and(
        eq(stat.questionId, questions.id),
        eq(stat.userId, userId),
    )

    // ---- 排序 ----
    // ordering 形如 "-createdAt" / "stats.lastAttemptAt",字段名用白名单映射挡住注入
    let orderBy = desc(questions.createdAt)
    if (ordering) {
        const isDesc = ordering.startsWith('-')
        const field = isDesc ? ordering.slice(1) : ordering

        const questionColumns = {
            createdAt: questions.createdAt,
            updatedAt: questions.updatedAt,
            title: questions.title,
            difficulty: questions.difficulty,
        } as const

        // stats.<field> 排序
        // 用 nulls last 而不是 coalesce(col, 0):stats 里有 timestamp 列
        // (lastAttemptAt / firstCorrectAt),coalesce(timestamp, 0) 类型对不上,
        // PG 直接报 42804。nulls last 对整数列语义等价,对时间列也更符合
        // "没做过的排最后"的业务预期。
        if (field.startsWith('stats.')) {
            const statField = field.slice('stats.'.length)
            const statColumns = {
                lastAttemptAt: stat.lastAttemptAt,
                totalAttempts: stat.totalAttempts,
                correctAttempts: stat.correctAttempts,
                firstCorrectAt: stat.firstCorrectAt,
                bestTime: stat.bestTime,
            } as const
            const col = statColumns[statField as keyof typeof statColumns]
            if (col) {
                orderBy = isDesc ? sql`${col} desc nulls last` : sql`${col} asc nulls last`
            }
        } else {
            const col = questionColumns[field as keyof typeof questionColumns]
            if (col) orderBy = isDesc ? desc(col) : asc(col)
        }
    }

    // ---- 分页查询 ----
    const from = db
        .select({
            id: questions.id,
            title: questions.title,
            type: questions.type,
            difficulty: questions.difficulty,
            tags: questions.tags,
            direction: questions.direction,
            techStack: questions.techStack,
            knowledgePoints: questions.knowledgePoints,
            visibility: questions.visibility,
            createdAt: questions.createdAt,
            updatedAt: questions.updatedAt,
            statTotalAttempts: sql<number>`coalesce(${stat.totalAttempts}, 0)`,
            statCorrectAttempts: sql<number>`coalesce(${stat.correctAttempts}, 0)`,
            statStatus: sql<QuestionStatus | null>`${stat.status}`,
            statLastAttemptAt: sql<Date | null>`${stat.lastAttemptAt}`,
        })
        .from(questions)
        .leftJoin(stat, joinOn)
        .where(where)
        .orderBy(orderBy)
        .limit(size)
        .offset((page - 1) * size)

    const rows = await from

    // ---- 总数 ----
    // 必须带同一个 join,否则 status 过滤下的 total 会偏大
    const [{ value: total }] = await db
        .select({ value: count() })
        .from(questions)
        .leftJoin(stat, joinOn)
        .where(where)

    return c.json({
        data: rows.map((r) => ({
            id: r.id,
            title: r.title,
            type: r.type,
            difficulty: r.difficulty,
            tags: r.tags,
            direction: r.direction,
            techStack: r.techStack,
            knowledgePoints: r.knowledgePoints,
            visibility: r.visibility,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            stats:
                r.statStatus === null
                    ? EMPTY_STATS
                    : {
                          totalAttempts: Number(r.statTotalAttempts),
                          correctAttempts: Number(r.statCorrectAttempts),
                          status: r.statStatus,
                          lastAttemptAt: r.statLastAttemptAt,
                      },
        })),
        total: Number(total),
        page,
        size,
    }, HttpStatusCodes.OK)
}

// ============================================================
// 详情
// ============================================================

export const mySubmissions: AppRouteHandler<MySubmissionsRoute> = async (c) => {
    const userId = c.get('userId')!

    const rows = await db
        .select({
            id: questions.id,
            title: questions.title,
            type: questions.type,
            difficulty: questions.difficulty,
            status: questions.status,
            reviewScore: questions.reviewScore,
            createdAt: questions.createdAt,
        })
        .from(questions)
        .where(and(eq(questions.createdBy, userId), ne(questions.status, 'approved')))
        .orderBy(desc(questions.createdAt))
        .limit(50)

    return c.json({ data: rows }, HttpStatusCodes.OK)
}

export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {    const { id } = c.req.valid('param')
    const userId = c.get('userId')!

    const [row] = await db.select().from(questions).where(eq(questions.id, id)).limit(1)
    // private 题对非 owner 一律 404,不区分"不存在"和"不可见",避免探测
    if (!row || (row.visibility === 'private' && row.createdBy !== userId)) {
        return c.json({ message: 'Not Found' }, HttpStatusCodes.NOT_FOUND)
    }

    // stat 和 lastAttempt 互不依赖,并行拉(B4):以前三条顺序 await,
    // 详情接口延迟 = 三次往返之和
    const [[stat], [lastAttempt]] = await Promise.all([
        db
            .select()
            .from(questionStats)
            .where(and(eq(questionStats.userId, userId), eq(questionStats.questionId, id)))
            .limit(1),
        db
            .select()
            .from(questionAttempts)
            .where(and(eq(questionAttempts.userId, userId), eq(questionAttempts.questionId, id)))
            .orderBy(desc(questionAttempts.createdAt))
            .limit(1),
    ])

    return c.json({
        id: row.id,
        title: row.title,
        type: row.type,
        content: row.content,
        answer: row.answer,
        difficulty: row.difficulty,
        tags: row.tags,
        direction: row.direction,
        techStack: row.techStack,
        knowledgePoints: row.knowledgePoints,
        visibility: row.visibility,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        // 没有统计记录时给一份完整形状的兜底行(字段与 questionStats 表一致),
        // 不再是只挑四个字段的小对象 —— 契约 schema 用 selectQuestionStatsSchema,
        // "有记录 / 没记录"两条路径的形状必须一致(B14)
        stats: stat ?? {
            userId,
            questionId: id,
            totalAttempts: 0,
            correctAttempts: 0,
            bestTime: null,
            firstCorrectAt: null,
            lastAttemptAt: null,
            status: 'not_started' as const,
        },
        lastAttempt: lastAttempt
            ? {
                  userAnswer: lastAttempt.userAnswer,
                  isCorrect: lastAttempt.isCorrect,
                  timeSpent: lastAttempt.timeSpent,
                  createdAt: lastAttempt.createdAt,
              }
            : null,
    }, HttpStatusCodes.OK)
}

// ============================================================
// 增删改
// ============================================================

export const create: AppRouteHandler<CreateRoute> = async (c) => {
    const userId = c.get('userId')!
    const body = c.req.valid('json')
    // AI 审核被显式关闭时,新题直接进人工队列(否则停在 draft,审核页看不到)
    const aiOff = aiReviewDisabled()
    const isAdmin = c.get('userRole') === 'admin'

    /**
     * 投稿配额(2026-11-13,普通用户)。
     *
     * 两个闸门:
     *  1. 队列上限 —— 未裁决的投稿到 10 条就停,防止一次性灌满审核队列
     *  2. 每日上限 —— 5 条/天,独立计数表,删题不重置
     * admin 豁免(编辑工作台要批量录题)。
     */
    if (!isAdmin) {
        const pending = await countPendingSubmissions(userId)
        if (pending >= QUESTION_PENDING_LIMIT) {
            return c.json(
                errorBody(
                    `待审核的投稿已有 ${pending} 条,等审核完再提交`,
                    'PENDING_LIMIT',
                ),
                HttpStatusCodes.TOO_MANY_REQUESTS,
            )
        }

        const quota = await consumeSubmitQuota(userId)
        if (quota.limited) {
            const retry = Math.ceil((new Date(quota.resetAt).getTime() - Date.now()) / 1000)
            c.header('Retry-After', String(retry))
            return c.json(
                errorBody(
                    `今日投稿次数已用完(${quota.limit} 条/天),明天重置`,
                    'SUBMIT_QUOTA_EXCEEDED',
                ),
                HttpStatusCodes.TOO_MANY_REQUESTS,
            )
        }
    }

    // 三级标签:老客户端只传 tags 也能自动归类;新表单可显式传三级字段
    const classified = classifyQuestion({
        title: body.title,
        content: body.content,
        answer: body.answer,
        tags: body.tags,
    })
    const direction = body.direction ?? classified.direction
    const techStack = body.techStack ?? classified.techStack
    const knowledgePoints =
        body.knowledgePoints && body.knowledgePoints.length
            ? body.knowledgePoints
            : classified.knowledgePoints
    const tags = [
        ...new Set([
            direction,
            techStack,
            ...knowledgePoints,
            ...(body.tags ?? []),
        ]),
    ].slice(0, 16)

    const [created] = await db
        .insert(questions)
        .values({
            ...body,
            // 没显式给 type 时按标题自动判定代码题/理论题
            type: body.type ?? detectQuestionType(body),
            // 没显式给题库时按技术栈归库,否则新题不属于任何 bank
            ...(body.bankId ? {} : { bankId: await resolveBankId(techStack, direction) }),
            // AI 关闭时直接进人工队列
            ...(aiOff ? { status: 'human_pending' as const } : {}),
            direction,
            techStack,
            knowledgePoints,
            tags,
            createdBy: userId,
        })
        .returning()

    // 新题自动送 AI 前置审核(docs/review-workflow-plan.md:创建即触发,
    // 验收标准"新加题自动触发 agent 审核")。
    // - 配额内:扣 1 次 + 异步送审(AI 结果走人工队列)
    // - 配额尽/admin 豁免/agent 忙:题照常创建,停在 draft,不阻塞
    if (created && !aiOff && !isReviewing(created.id)) {
        const admin = c.get('userRole') === 'admin'
        if (!admin) {
            const quotaState = await consumeQuota(userId)
            if (!quotaState.limited) {
                void runReview(created.id).catch((err) => {
                    c.get('logger')?.error({ err, questionId: created.id }, 'review agent crashed')
                })
            }
        } else {
            void runReview(created.id).catch((err) => {
                c.get('logger')?.error({ err, questionId: created.id }, 'review agent crashed')
            })
        }
    }

    return c.json(selectQuestionsSchema.parse(created), HttpStatusCodes.OK)
}

export const update: AppRouteHandler<UpdateRoute> = async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')

    /**
     * 权限边界(2026-11-13):题目内容只允许管理员修改。
     *
     * 之前是「创建者可以改自己的题」,问题在于题一旦过审进入公开题库,
     * 创建者仍能改标题/答案 —— 等于普通用户可以直接改写线上内容,
     * 绕过审核。现在普通用户只有「查看 + 练习」,投稿走人工审核。
     */
    const isAdmin = c.get('userRole') === 'admin'
    if (!isAdmin) {
        return c.json(
            errorBody('只有管理员可以修改题目', 'FORBIDDEN'),
            HttpStatusCodes.FORBIDDEN,
        )
    }

    // 管理员可以改任何题(编辑工作台的性质),不再限于「自己创建的」
    const [updated] = await db
        .update(questions)
        .set(body)
        .where(eq(questions.id, id))
        .returning()
    if (!updated) return c.json({ message: 'Not Found' }, HttpStatusCodes.NOT_FOUND)

    // 编辑后重算三级标签;显式传了 direction/techStack/points 时以表单为准
    const classified = classifyQuestion({
        title: updated.title,
        content: updated.content,
        answer: updated.answer,
        tags: updated.tags,
    })
    const direction = body.direction ?? updated.direction ?? classified.direction
    const techStack = body.techStack ?? updated.techStack ?? classified.techStack
    const knowledgePoints =
        body.knowledgePoints && body.knowledgePoints.length
            ? body.knowledgePoints
            : updated.knowledgePoints?.length
              ? updated.knowledgePoints
              : classified.knowledgePoints
    const tags = [
        ...new Set([direction, techStack, ...knowledgePoints, ...(updated.tags ?? [])]),
    ].slice(0, 16)
    const [final] = await db
        .update(questions)
        .set({ direction, techStack, knowledgePoints, tags })
        .where(eq(questions.id, id))
        .returning()

    return c.json(selectQuestionsSchema.parse(final), HttpStatusCodes.OK)
}

export const remove: AppRouteHandler<RemoveRoute> = async (c) => {
    const { id } = c.req.valid('param')
    const userId = c.get('userId')!

    const [row] = await db
        .select({ createdBy: questions.createdBy, status: questions.status })
        .from(questions)
        .where(eq(questions.id, id))
        .limit(1)
    if (!row) return c.json({ message: 'Question not found' }, HttpStatusCodes.NOT_FOUND)

    /**
     * 删除规则(2026-11-13):
     *   - admin:任意题
     *   - 普通用户:只能撤回**自己还没过审**的投稿
     *     (已过审的题在公开站上,删了会留死链,必须走管理员)
     */
    if (c.get('userRole') !== 'admin') {
        if (row.createdBy !== userId) {
            return c.json(
                errorBody('只能撤回自己的投稿', 'FORBIDDEN'),
                HttpStatusCodes.FORBIDDEN,
            )
        }
        if (row.status === 'approved') {
            return c.json(
                errorBody('已发布的题目需要管理员处理', 'FORBIDDEN'),
                HttpStatusCodes.FORBIDDEN,
            )
        }
    }

    // question_stats / question_attempts 由 FK ON DELETE CASCADE 清理,
    // 不再手工两连删
    await db.delete(questions).where(eq(questions.id, id))

    return c.json({ message: 'success' }, HttpStatusCodes.OK)
}

// ============================================================
// 作答
// ============================================================

export const submit: AppRouteHandler<SubmitRoute> = async (c) => {
    const { id } = c.req.valid('param')
    const userId = c.get('userId')!
    const { userAnswer, timeSpent } = c.req.valid('json')

    const [question] = await db.select().from(questions).where(eq(questions.id, id)).limit(1)
    // private 题非 owner 不可练,与 getOne 同口径
    if (!question || (question.visibility === 'private' && question.createdBy !== userId)) {
        return c.json({ message: 'Question not found' }, HttpStatusCodes.NOT_FOUND)
    }

    // attempt 流水和 stats 汇总必须同生共死(B1):以前两步裸奔,中途失败
    // (进程被杀/约束冲突)两边永久失配,统计口径再也对不回来
    const { attempt } = await db.transaction(async (tx) => {
        // SQL 侧自增:两个会话并发作答时,各自读旧值再互相覆盖会丢计数。
        // lastAttemptAt 用 now() 而不是 attempt.createdAt —— 此刻 attempt
        // 还没插入,两者语义等价(都是"这次提交的时刻")
        const [stat] = await tx
            .insert(questionStats)
            .values({
                userId,
                questionId: id,
                totalAttempts: 1,
                correctAttempts: 0,
                lastAttemptAt: sql`now()`,
                firstCorrectAt: null,
                bestTime: null,
                status: 'in_progress',
            })
            .onConflictDoUpdate({
                target: [questionStats.userId, questionStats.questionId],
                set: {
                    totalAttempts: sql`${questionStats.totalAttempts} + 1`,
                    lastAttemptAt: sql`now()`,
                    status: 'in_progress',
                },
            })
            .returning()

        const [attempt] = await tx
            .insert(questionAttempts)
            .values({
                userId,
                questionId: id,
                userAnswer: userAnswer ?? null,
                timeSpent: timeSpent ?? null,
                // 直接取自同事务里刚自增完的 stats 行,不再用 JS 读旧值 +1
                attemptCount: stat.totalAttempts,
            })
            .returning()

        return { attempt, stat }
    })

    return c.json(
        {
            attempt: {
                id: attempt.id,
                userAnswer: attempt.userAnswer,
                timeSpent: attempt.timeSpent,
                attemptCount: attempt.attemptCount,
                createdAt: attempt.createdAt,
            },
            answer: question.answer,
            question: { title: question.title, content: question.content },
        },
        HttpStatusCodes.OK,
    )
}

export const markCorrect: AppRouteHandler<MarkCorrectRoute> = async (c) => {
    const { id, attemptId } = c.req.valid('param')
    const userId = c.get('userId')!
    const { isCorrect } = c.req.valid('json')

    // 判分 + 统计更新放进同一事务(B1);attempt 的存在性检查用
    // update ... returning 一并原子完成,不存在(或不是本人的)时 returning 为空
    const result = await db.transaction(async (tx) => {
        const [updatedAttempt] = await tx
            .update(questionAttempts)
            .set({ isCorrect })
            .where(
                and(
                    eq(questionAttempts.id, attemptId),
                    eq(questionAttempts.userId, userId),
                    eq(questionAttempts.questionId, id),
                ),
            )
            .returning()

        if (!updatedAttempt) return { notFound: true as const, stats: null }

        // 只有判对才动 stat;判错不动 correctAttempts,只保持原状态
        if (!isCorrect) {
            const [stat] = await tx
                .select()
                .from(questionStats)
                .where(and(eq(questionStats.userId, userId), eq(questionStats.questionId, id)))
                .limit(1)
            return { notFound: false as const, stats: stat ?? null }
        }

        const [stat] = await tx
            .insert(questionStats)
            .values({
                userId,
                questionId: id,
                totalAttempts: 1,
                correctAttempts: 1,
                firstCorrectAt: updatedAttempt.createdAt,
                bestTime: updatedAttempt.timeSpent,
                status: 'completed',
            })
            .onConflictDoUpdate({
                target: [questionStats.userId, questionStats.questionId],
                set: {
                    // stat 里已有的 totalAttempts 可能比 attempt 大,不能覆盖成 1
                    // 表名限定引用的是 ON CONFLICT 里的"既有行"(旧值),不是新值
                    correctAttempts: sql`${questionStats.correctAttempts} + 1`,
                    status: 'completed' as const,
                    // sql 模板不像 values() 那样按列类型做 Date 序列化,
                    // 直接绑 JS Date 会被 postgres.js toString() 成
                    // "Sun Oct 11 2026 ..." 而非 ISO,PG 解析不了 → 500。
                    // 显式转 ISO 字符串,PG 按 unknown literal 推断成 timestamp。
                    firstCorrectAt: sql`coalesce(${questionStats.firstCorrectAt}, ${updatedAttempt.createdAt.toISOString()})`,
                    // 同上:timeSpent 可能是 null,统一兜成 0 再取最小值
                    bestTime: sql`least(coalesce(${questionStats.bestTime}, ${updatedAttempt.timeSpent ?? 0}), ${updatedAttempt.timeSpent ?? 0})`,
                },
            })
            .returning()

        return { notFound: false as const, stats: stat }
    })

    if (result.notFound) {
        return c.json({ message: 'Attempt not found' }, HttpStatusCodes.NOT_FOUND)
    }

    return c.json({ success: true, stats: result.stats }, HttpStatusCodes.OK)
}

export const getAttempts: AppRouteHandler<GetAttemptsRoute> = async (c) => {
    const { id } = c.req.valid('param')
    const userId = c.get('userId')!

    const rows = await db
        .select()
        .from(questionAttempts)
        .where(and(eq(questionAttempts.userId, userId), eq(questionAttempts.questionId, id)))
        .orderBy(desc(questionAttempts.createdAt))
        // 上限兜底(B4):刷题上千次后不能一次拖全量;练习页只展示最近历史,
        // 100 条足够。需要全量再走分页参数
        .limit(100)

    return c.json(rows)
}

// ============================================================
// 汇总统计
// ============================================================

export const getStats: AppRouteHandler<GetStatsRoute> = async (c) => {
    const userId = c.get('userId')!

    // 一次 GROUP BY 把所有口径算完(B4):以前把该用户全部 stats 行拉进
    // JS 内存 filter/reduce,题量上万时每次打开统计页都拖全量
    const statusRowsPromise = db
        .select({
            status: questionStats.status,
            statCount: count(),
            totalAttempts: sql<number>`coalesce(sum(${questionStats.totalAttempts}), 0)`,
            correctAttempts: sql<number>`coalesce(sum(${questionStats.correctAttempts}), 0)`,
            totalTime: sql<number>`coalesce(sum(${questionStats.bestTime}), 0)`,
        })
        .from(questionStats)
        .where(eq(questionStats.userId, userId))
        .groupBy(questionStats.status)

    // total 的口径 = 当前用户可见且已过审的题库(shared + 自己的题)
    const totalPromise = db
        .select({ value: count() })
        .from(questions)
        .where(approvedBank(userId))

    const [statusRows, [{ value: total }]] = await Promise.all([statusRowsPromise, totalPromise])

    let completed = 0
    let inProgress = 0
    let totalAttempts = 0
    let correctAttempts = 0
    let totalTime = 0
    for (const row of statusRows) {
        totalAttempts += Number(row.totalAttempts)
        correctAttempts += Number(row.correctAttempts)
        totalTime += Number(row.totalTime)
        if (row.status === 'completed') completed = Number(row.statCount)
        else if (row.status === 'in_progress') inProgress = Number(row.statCount)
    }

    const accuracy = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0

    return c.json({
        total: Number(total),
        completed,
        inProgress,
        // 未过审题可能留有旧的练习统计,兜零避免负数
        notStarted: Math.max(0, Number(total) - completed - inProgress),
        accuracy: Math.round(accuracy * 100) / 100,
        totalTime,
    })
}