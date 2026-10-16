import { and, asc, count, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type {
    ListRoute,
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
import {
    questionAttempts,
    questionStats,
    questions,
    selectQuestionsSchema,
} from '../../db/schema.js'
import { HttpStatusCodes } from '../../lib/openapi.js'

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

export const list: AppRouteHandler<ListRoute> = async (c) => {
    const userId = c.get('userId')!
    const { type, difficulty, tag, status, page, size, ordering, search } = c.req.valid('query')

    // 可见性永远第一位;后面再叠加业务过滤
    const conditions = [visibleBank(userId)]
    if (type) conditions.push(eq(questions.type, type))
    if (difficulty) conditions.push(eq(questions.difficulty, difficulty))
    if (search) conditions.push(ilike(questions.title, `%${search}%`))
    // MySQL 的 JSON_CONTAINS(q.tags, '"x"') → PG jsonb 包含操作符 @>
    if (tag) conditions.push(sql`${questions.tags} @> ${JSON.stringify([tag])}::jsonb`)

    const needsStatsJoin = Boolean(status) || Boolean(ordering?.includes('stats.'))

    // 带别名的 question_stats 副本 —— select / orderBy / where 一律引用它。
    // 用原表名 questionStats 会被 PG 判成 42P01(undefined table)
    const stat = alias(questionStats, 'stat')

    // status 过滤需要 join question_stats:not_started 还要包含"完全没有记录"的题
    if (status === 'not_started' && needsStatsJoin) {
        conditions.push(
            or(
                eq(stat.status, 'not_started'),
                isNull(stat.questionId),
            )!,
        )
    } else if (status && needsStatsJoin) {
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
    const from = needsStatsJoin
        ? db
              .select({
                  id: questions.id,
                  title: questions.title,
                  type: questions.type,
                  difficulty: questions.difficulty,
                  tags: questions.tags,
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
        : db
              .select({
                  id: questions.id,
                  title: questions.title,
                  type: questions.type,
                  difficulty: questions.difficulty,
                  tags: questions.tags,
                  visibility: questions.visibility,
                  createdAt: questions.createdAt,
                  updatedAt: questions.updatedAt,
                  statTotalAttempts: sql<number>`0`,
                  statCorrectAttempts: sql<number>`0`,
                  statStatus: sql<QuestionStatus | null>`null`,
                  statLastAttemptAt: sql<Date | null>`null`,
              })
              .from(questions)
              .where(where)
              .orderBy(orderBy)
              .limit(size)
              .offset((page - 1) * size)

    const rows = await from

    // ---- 总数 ----
    // 同样要带上 stat join,否则 status 过滤下的 total 会偏大
    const [{ value: total }] = needsStatsJoin
        ? await db
              .select({ value: count() })
              .from(questions)
              .leftJoin(stat, joinOn)
              .where(where)
        : await db.select({ value: count() }).from(questions).where(where)

    return c.json({
        data: rows.map((r) => ({
            id: r.id,
            title: r.title,
            type: r.type,
            difficulty: r.difficulty,
            tags: r.tags,
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

export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
    const { id } = c.req.valid('param')
    const userId = c.get('userId')!

    const [row] = await db.select().from(questions).where(eq(questions.id, id)).limit(1)
    // private 题对非 owner 一律 404,不区分"不存在"和"不可见",避免探测
    if (!row || (row.visibility === 'private' && row.createdBy !== userId)) {
        return c.json({ message: 'Not Found' } as never, HttpStatusCodes.NOT_FOUND)
    }

    const [stat] = await db
        .select()
        .from(questionStats)
        .where(and(eq(questionStats.userId, userId), eq(questionStats.questionId, id)))
        .limit(1)

    const [lastAttempt] = await db
        .select()
        .from(questionAttempts)
        .where(and(eq(questionAttempts.userId, userId), eq(questionAttempts.questionId, id)))
        .orderBy(desc(questionAttempts.createdAt))
        .limit(1)

    return c.json({
        id: row.id,
        title: row.title,
        type: row.type,
        content: row.content,
        answer: row.answer,
        difficulty: row.difficulty,
        tags: row.tags,
        visibility: row.visibility,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        // 旧代码 stat 为 null 时返回一份带 bestTime 的兜底对象
        stats: stat ?? { ...EMPTY_STATS, bestTime: null },
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

    const [created] = await db.insert(questions).values({ ...body, createdBy: userId }).returning()
    return c.json(selectQuestionsSchema.parse(created), HttpStatusCodes.OK)
}

export const update: AppRouteHandler<UpdateRoute> = async (c) => {
    const { id } = c.req.valid('param')
    const userId = c.get('userId')!
    const body = c.req.valid('json')

    // 只有创建者能改 —— 旧代码的 findOne({id, createdBy: userId}) 隐含了这个约束
    const [updated] = await db
        .update(questions)
        .set(body)
        .where(and(eq(questions.id, id), eq(questions.createdBy, userId)))
        .returning()
    if (!updated) return c.json({ message: 'Not Found' }, HttpStatusCodes.NOT_FOUND)

    return c.json(selectQuestionsSchema.parse(updated), HttpStatusCodes.OK)
}

export const remove: AppRouteHandler<RemoveRoute> = async (c) => {
    const { id } = c.req.valid('param')
    const userId = c.get('userId')!

    const [row] = await db
        .select({ createdBy: questions.createdBy })
        .from(questions)
        .where(eq(questions.id, id))
        .limit(1)
    if (!row) return c.json({ message: 'Question not found' }, HttpStatusCodes.NOT_FOUND)

    // 只有创建者能删(created_by 已 NOT NULL,旧"无主人人可删"分支不复存在)
    if (row.createdBy !== userId) {
        return c.json(
            { message: 'You can only delete questions you created' },
            HttpStatusCodes.NOT_FOUND,
        )
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

    // 取现有统计,没有就建一条
    const [existing] = await db
        .select()
        .from(questionStats)
        .where(and(eq(questionStats.userId, userId), eq(questionStats.questionId, id)))
        .limit(1)

    const prevAttempts = existing?.totalAttempts ?? 0

    const [attempt] = await db
        .insert(questionAttempts)
        .values({
            userId,
            questionId: id,
            userAnswer: userAnswer ?? null,
            timeSpent: timeSpent ?? null,
            attemptCount: prevAttempts + 1,
        })
        .returning()

    // 提交答案只把状态推进到 in_progress,判对错要等 PATCH attempts/:attemptId
    const [updatedStat] = await db
        .insert(questionStats)
        .values({
            userId,
            questionId: id,
            totalAttempts: prevAttempts + 1,
            correctAttempts: existing?.correctAttempts ?? 0,
            lastAttemptAt: attempt.createdAt,
            firstCorrectAt: existing?.firstCorrectAt ?? null,
            bestTime: existing?.bestTime ?? null,
            status: 'in_progress',
        })
        .onConflictDoUpdate({
            target: [questionStats.userId, questionStats.questionId],
            set: {
                // SQL 侧自增而不是 JS 里的 prevAttempts + 1:两个会话并发作答时,
                // 各自读到的 prevAttempts 相同,互相覆盖会丢计数(P8,见加固文档)
                totalAttempts: sql`${questionStats.totalAttempts} + 1`,
                lastAttemptAt: attempt.createdAt,
                status: 'in_progress',
            },
        })
        .returning()

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

    const [attempt] = await db
        .select()
        .from(questionAttempts)
        .where(
            and(
                eq(questionAttempts.id, attemptId),
                eq(questionAttempts.userId, userId),
                eq(questionAttempts.questionId, id),
            ),
        )
        .limit(1)
    if (!attempt) return c.json({ message: 'Attempt not found' }, HttpStatusCodes.NOT_FOUND)

    await db
        .update(questionAttempts)
        .set({ isCorrect })
        .where(eq(questionAttempts.id, attemptId))

    // 只有判对才动 stat;判错不动 correctAttempts,只保持原状态
    const [updatedStat] = isCorrect
        ? await db
              .insert(questionStats)
              .values({
                  userId,
                  questionId: id,
                  totalAttempts: 1,
                  correctAttempts: 1,
                  firstCorrectAt: attempt.createdAt,
                  bestTime: attempt.timeSpent,
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
                      firstCorrectAt: sql`coalesce(${questionStats.firstCorrectAt}, ${attempt.createdAt.toISOString()})`,
                      // 同上:timeSpent 可能是 null,统一兜成 0 再取最小值
                      bestTime: sql`least(coalesce(${questionStats.bestTime}, ${attempt.timeSpent ?? 0}), ${attempt.timeSpent ?? 0})`,
                  },
              })
              .returning()
        : await db
              .select()
              .from(questionStats)
              .where(and(eq(questionStats.userId, userId), eq(questionStats.questionId, id)))
              .limit(1)

    return c.json({ success: true, stats: updatedStat ?? null }, HttpStatusCodes.OK)
}

export const getAttempts: AppRouteHandler<GetAttemptsRoute> = async (c) => {
    const { id } = c.req.valid('param')
    const userId = c.get('userId')!

    const rows = await db
        .select()
        .from(questionAttempts)
        .where(and(eq(questionAttempts.userId, userId), eq(questionAttempts.questionId, id)))
        .orderBy(desc(questionAttempts.createdAt))

    return c.json(rows)
}

// ============================================================
// 汇总统计
// ============================================================

export const getStats: AppRouteHandler<GetStatsRoute> = async (c) => {
    const userId = c.get('userId')!

    const stats = await db.select().from(questionStats).where(eq(questionStats.userId, userId))
    // total 的口径 = 当前用户可见题库(shared + 自己的题),不再是全表
    const [{ value: total }] = await db
        .select({ value: count() })
        .from(questions)
        .where(visibleBank(userId))

    const completed = stats.filter((s) => s.status === 'completed').length
    const inProgress = stats.filter((s) => s.status === 'in_progress').length
    const notStarted = Number(total) - completed - inProgress

    const totalAttempts = stats.reduce((sum, s) => sum + s.totalAttempts, 0)
    const correctAttempts = stats.reduce((sum, s) => sum + s.correctAttempts, 0)
    const accuracy = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0
    const totalTime = stats.reduce((sum, s) => sum + (s.bestTime || 0), 0)

    return c.json({
        total: Number(total),
        completed,
        inProgress,
        notStarted,
        accuracy: Math.round(accuracy * 100) / 100,
        totalTime,
    })
}