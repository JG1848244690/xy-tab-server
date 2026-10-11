/**
 * 统计模块实现
 *
 * 与旧 Nest 版的差别:
 * 旧代码有 3 处「全表 find() 拉进内存再 JS 过滤分页」,数据量上来必炸。
 * 这里全部下推到 SQL:
 *   - getIncompleteQuestions → LEFT JOIN + WHERE status IS DISTINCT FROM 'completed' + LIMIT/OFFSET
 *   - getTagDistribution     → jsonb_array_elements_text 展开后在 SQL 里 GROUP BY
 *   - getRecentCompletedQuestions → 直接 JOIN,不再二次查 question 详情
 *
 * 视频相关的 5 个查询(旧版 dashboard 里的 videoRepo / progressRepo)
 * 本轮不迁,统一返回空结构,见 stats.routes.ts 的 emptyVideosSchema。
 */

import { and, count, desc, eq, gte, isNull, lte, ne, or, sql } from 'drizzle-orm'
import type {
    DashboardRoute,
    PracticeTrendRoute,
    TagDistributionRoute,
    DifficultyDistributionRoute,
    IncompleteQuestionsRoute,
    RecentAddedQuestionsRoute,
    RecentCompletedQuestionsRoute,
} from './stats.routes.js'
import type { AppRouteHandler } from '../../lib/types.js'
import db from '../../db/index.js'
import { questionAttempts, questionStats, questions, todos } from '../../db/schema.js'
import { HttpStatusCodes } from '../../lib/openapi.js'

/** 本地时区的今天零点 */
const startOfToday = () => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** 本周一零点(旧代码用 now.getDay() || 7 - 1,周一为一周之始) */
const startOfWeek = (today: Date) =>
    new Date(today.getTime() - ((today.getDay() || 7) - 1) * 24 * 60 * 60 * 1000)

const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const MM_DD = (d: Date) =>
    `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** question_stats.status 的三种取值,与 pgEnum question_status 对齐 */
type QuestionStatus = 'not_started' | 'in_progress' | 'completed'

// ============================================================
// dashboard
// ============================================================

export const dashboard: AppRouteHandler<DashboardRoute> = async (c) => {
    const userId = c.get('userId')!

    const now = new Date()
    const today = startOfToday()
    const weekStart = startOfWeek(today)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const todayStr = ymd(today)
    const weekStartStr = ymd(weekStart)
    const todayEndStr = ymd(now)

    const [
        recentAddedQuestions,
        recentAttempted,
        totalAttempts,
        totalCorrect,
        thisWeekAddedQuestions,
        thisWeekAttemptedQuestions,
        todayTodos,
        weekTodos,
    ] = await Promise.all([
        // 最近添加的题目(近 7 天)—— 视频表没了,对应项移除
        db
            .select({
                id: questions.id,
                title: questions.title,
                difficulty: questions.difficulty,
                createdAt: questions.createdAt,
            })
            .from(questions)
            .where(gte(questions.createdAt, sevenDaysAgo))
            .orderBy(desc(questions.createdAt))
            .limit(5),

        // 最近做过的题目:JOIN 题目表直接带出 title,旧版是查完再补标题
        db
            .select({
                id: questionAttempts.id,
                questionId: questionAttempts.questionId,
                questionTitle: questions.title,
                isCorrect: questionAttempts.isCorrect,
                createdAt: questionAttempts.createdAt,
            })
            .from(questionAttempts)
            .innerJoin(questions, eq(questions.id, questionAttempts.questionId))
            .where(and(eq(questionAttempts.userId, userId), gte(questionAttempts.createdAt, sevenDaysAgo)))
            .orderBy(desc(questionAttempts.createdAt))
            .limit(5),

        db.select({ value: count() }).from(questionAttempts).where(eq(questionAttempts.userId, userId)),

        // is_correct 是 PG boolean,直接 where(isCorrect = true)
        db
            .select({ value: count() })
            .from(questionAttempts)
            .where(and(eq(questionAttempts.userId, userId), eq(questionAttempts.isCorrect, true))),

        db.select({ value: count() }).from(questions).where(gte(questions.createdAt, weekStart)),

        db
            .select({ value: count() })
            .from(questionAttempts)
            .where(and(eq(questionAttempts.userId, userId), gte(questionAttempts.createdAt, weekStart))),

        // 今日打卡
        db
            .select({ completed: todos.completed })
            .from(todos)
            .where(and(eq(todos.userId, userId), eq(sql`${todos.startDate}::text`, todayStr))),

        // 本周打卡:start_date 落在 [本周一, 今天]
        db
            .select({ completed: todos.completed })
            .from(todos)
            .where(
                and(
                    eq(todos.userId, userId),
                    gte(sql`${todos.startDate}::text`, weekStartStr),
                    lte(sql`${todos.startDate}::text`, todayEndStr),
                ),
            ),
    ])

    const n = (rows: { value: number }[]) => Number(rows[0]?.value ?? 0)

    const totalAttemptsCount = n(totalAttempts)
    const totalCorrectCount = n(totalCorrect)
    const accuracy = totalAttemptsCount > 0 ? (totalCorrectCount / totalAttemptsCount) * 100 : 0

    const thisWeekAdded = n(thisWeekAddedQuestions)
    const thisWeekAttempted = n(thisWeekAttemptedQuestions)

    const todayCompleted = todayTodos.filter((t) => t.completed).length
    const weekCompleted = weekTodos.filter((t) => t.completed).length
    const completionRate = weekTodos.length > 0 ? (weekCompleted / weekTodos.length) * 100 : 0

    return c.json(
        {
            questions: {
                recentAdded: recentAddedQuestions,
                recentAttempted,
                totalAttempts: totalAttemptsCount,
                totalCorrect: totalCorrectCount,
                accuracy: Number(accuracy.toFixed(1)),
                thisWeekAdded,
                thisWeekAttempted,
            },
            // 视频模块本轮不迁,返回结构完整的空数据(前端 home 页会读这些字段)
            videos: {
                recentAdded: [],
                recentWatched: [],
                totalVideos: 0,
                inProgress: 0,
                thisWeekAdded: 0,
            },
            todos: {
                todayCompleted,
                todayTotal: todayTodos.length,
                thisWeekCompleted: weekCompleted,
                thisWeekTotal: weekTodos.length,
                completionRate: Number(completionRate.toFixed(1)),
            },
            summary: {
                thisWeekQuestionsAdded: thisWeekAdded,
                thisWeekQuestionsAttempted: thisWeekAttempted,
                thisWeekVideosAdded: 0,
                thisWeekTodosCompleted: weekCompleted,
            },
        },
        HttpStatusCodes.OK,
    )
}

// ============================================================
// practice-trend —— 折线图
// ============================================================

export const practiceTrend: AppRouteHandler<PracticeTrendRoute> = async (c) => {
    const userId = c.get('userId')!
    const { days, type } = c.req.valid('query')

    const now = new Date()
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    // MySQL 的 DATE(created_at) → PG 的 date_trunc('day', ...)
    // 一次查询拿全,而不是像旧版那样按天循环
    //
    // select 里的 to_char 必须包在 date_trunc 内,与 group by 完全一致 ——
    // PG 要求非聚合的 select 表达式出现在 group by 里(to_char(原列) 与
    // group by date_trunc(原列) 不匹配,报 42803 ungrouped column)。
    const day = sql`date_trunc('day', ${questionAttempts.createdAt})`
    const rows = await db
        .select({
            day: sql<string>`to_char(date_trunc('day', ${questionAttempts.createdAt}), 'YYYY-MM-DD')`,
            count: sql<number>`count(*)::int`,
            totalTime: sql<number>`coalesce(sum(coalesce(${questionAttempts.timeSpent}, 0)), 0)::bigint`,
        })
        .from(questionAttempts)
        .where(and(eq(questionAttempts.userId, userId), gte(questionAttempts.createdAt, startDate)))
        .groupBy(day)
        .orderBy(day)

    const dataMap = new Map(
        rows.map((r) => [
            r.day,
            {
                count: Number(r.count),
                // 秒 → 分钟,与旧版一致
                totalTime: Math.round(Number(r.totalTime) / 60),
            },
        ]),
    )

    // 生成完整日期轴,没数据的补 0 —— 折线图不断点
    const result = []
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const key = MM_DD(d)
        const data = dataMap.get(ymd(d))
        result.push({
            date: key,
            value: data ? (type === 'frequency' ? data.count : data.totalTime) : 0,
        })
    }

    return c.json(result, HttpStatusCodes.OK)
}

// ============================================================
// 饼图
// ============================================================

/** 旧版把 json 数组全拉进内存用 JS 统计;这里在 SQL 里展开 jsonb 数组再 group by */
export const tagDistribution: AppRouteHandler<TagDistributionRoute> = async (c) => {
    // 展开后的结果集要包成派生表并起别名 t,PG 才认(裸子查询当 FROM 会 42601),
    // 之后所有列引用都得走 t. 前缀
    const exploded = sql`
        select jsonb_array_elements_text(${questions.tags}) as tag
        from ${questions}
        where ${questions.tags} is not null
    `
    const rows = await db
        .select({
            name: sql<string>`t.tag`,
            count: sql<number>`count(*)::int`,
        })
        .from(sql`(${exploded}) as t`)
        .groupBy(sql`t.tag`)
        .orderBy(desc(sql`count(*)`))

    const totalTags = rows.reduce((sum, r) => sum + Number(r.count), 0)

    return c.json(
        rows.map((r) => ({
            name: r.name,
            value: totalTags > 0 ? Math.round((Number(r.count) / totalTags) * 100 * 10) / 10 : 0,
            count: Number(r.count),
        })),
        HttpStatusCodes.OK,
    )
}

export const difficultyDistribution: AppRouteHandler<DifficultyDistributionRoute> = async (c) => {
    const rows = await db
        .select({ difficulty: questions.difficulty, count: sql<number>`count(*)::int` })
        .from(questions)
        .groupBy(questions.difficulty)

    const total = rows.reduce((sum, r) => sum + Number(r.count), 0)
    const labels = { easy: '简单', medium: '中等', hard: '困难' } as const

    return c.json(
        rows.map((r) => ({
            name: labels[r.difficulty] ?? r.difficulty,
            value: total > 0 ? Math.round((Number(r.count) / total) * 100 * 10) / 10 : 0,
            count: Number(r.count),
            difficulty: r.difficulty,
        })),
        HttpStatusCodes.OK,
    )
}

// ============================================================
// 滚动分页列表
// ============================================================

/**
 * 未完成的题目。
 *
 * 旧版把全部题目和全部 stats 拉进 Node 内存,用 JS filter + slice 分页 ——
 * 题库一大就吃满内存。这里改成 LEFT JOIN + SQL WHERE + LIMIT/OFFSET。
 */
export const incompleteQuestions: AppRouteHandler<IncompleteQuestionsRoute> = async (c) => {
    const userId = c.get('userId')!
    const { page, size } = c.req.valid('query')

    // 没有 stat 记录(=未开始)或 status 不为 completed,都算未完成
    const notCompleted = or(isNull(questionStats.questionId), ne(questionStats.status, 'completed'))!

    const rows = await db
        .select({
            id: questions.id,
            title: questions.title,
            difficulty: questions.difficulty,
            tags: questions.tags,
            createdAt: questions.createdAt,
            statTotalAttempts: sql<number>`coalesce(${questionStats.totalAttempts}, 0)`,
            statCorrectAttempts: sql<number>`coalesce(${questionStats.correctAttempts}, 0)`,
            statStatus: sql<QuestionStatus | null>`${questionStats.status}`,
        })
        .from(questions)
        .leftJoin(
            questionStats,
            and(
                eq(questionStats.questionId, questions.id),
                eq(questionStats.userId, userId),
            ),
        )
        .where(notCompleted)
        .orderBy(desc(questions.createdAt))
        .limit(size)
        .offset((page - 1) * size)

    const [{ value: total }] = await db
        .select({ value: count() })
        .from(questions)
        .leftJoin(
            questionStats,
            and(
                eq(questionStats.questionId, questions.id),
                eq(questionStats.userId, userId),
            ),
        )
        .where(notCompleted)

    const totalCount = Number(total)

    return c.json(
        {
            data: rows.map((r) => ({
                id: r.id,
                title: r.title,
                difficulty: r.difficulty,
                tags: r.tags,
                createdAt: r.createdAt,
                stats: {
                    totalAttempts: Number(r.statTotalAttempts),
                    correctAttempts: Number(r.statCorrectAttempts),
                    status: r.statStatus ?? ('not_started' as const),
                },
            })),
            total: totalCount,
            page,
            size,
            hasMore: (page - 1) * size + rows.length < totalCount,
        },
        HttpStatusCodes.OK,
    )
}

export const recentAddedQuestions: AppRouteHandler<RecentAddedQuestionsRoute> = async (c) => {
    const { page, size } = c.req.valid('query')

    const rows = await db
        .select({
            id: questions.id,
            title: questions.title,
            difficulty: questions.difficulty,
            tags: questions.tags,
            createdAt: questions.createdAt,
        })
        .from(questions)
        .orderBy(desc(questions.createdAt))
        .limit(size)
        .offset((page - 1) * size)

    const [{ value: total }] = await db.select({ value: count() }).from(questions)
    const totalCount = Number(total)

    return c.json(
        {
            data: rows,
            total: totalCount,
            page,
            size,
            hasMore: (page - 1) * size + rows.length < totalCount,
        },
        HttpStatusCodes.OK,
    )
}

export const recentCompletedQuestions: AppRouteHandler<RecentCompletedQuestionsRoute> = async (c) => {
    const userId = c.get('userId')!
    const { page, size } = c.req.valid('query')

    // 直接 JOIN,旧版是「先查 stats 再按 id 批量查 question 再在 JS 里拼」
    const rows = await db
        .select({
            id: questions.id,
            title: questions.title,
            difficulty: questions.difficulty,
            tags: questions.tags,
            firstCorrectAt: questionStats.firstCorrectAt,
            totalAttempts: questionStats.totalAttempts,
        })
        .from(questionStats)
        .innerJoin(questions, eq(questions.id, questionStats.questionId))
        .where(and(eq(questionStats.userId, userId), eq(questionStats.status, 'completed')))
        .orderBy(desc(questionStats.firstCorrectAt))
        .limit(size)
        .offset((page - 1) * size)

    const [{ value: total }] = await db
        .select({ value: count() })
        .from(questionStats)
        .where(and(eq(questionStats.userId, userId), eq(questionStats.status, 'completed')))
    const totalCount = Number(total)

    return c.json(
        {
            data: rows.map((r) => ({
                id: r.id,
                title: r.title,
                difficulty: r.difficulty,
                tags: r.tags,
                completedAt: r.firstCorrectAt,
                totalAttempts: r.totalAttempts,
            })),
            total: totalCount,
            page,
            size,
            hasMore: (page - 1) * size + rows.length < totalCount,
        },
        HttpStatusCodes.OK,
    )
}