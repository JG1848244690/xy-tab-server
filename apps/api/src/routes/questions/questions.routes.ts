import { createRoute, z } from '@hono/zod-openapi'
import {
    HttpStatusCodes,
    createErrorSchema,
    createMessageObjectSchema,
    jsonContent,
    jsonContentRequired,
} from '../../lib/openapi.js'
import {
    insertQuestionsSchema,
    selectQuestionAttemptsSchema,
    selectQuestionStatsSchema,
    selectQuestionsSchema,
} from '../../db/schema.js'
import { notFoundSchema } from '../../lib/constants.js'

const tags = ['Questions']

/** 路径参数:id 是 uuid,非法格式在 zod 层就被 422 拦掉 */
const IdParamsSchema = z.object({ id: z.string().uuid() })

const difficultySchema = z.enum(['easy', 'medium', 'hard'])
const statusSchema = z.enum(['not_started', 'in_progress', 'completed'])

/**
 * 题目公共字段直接从表 schema 派生(B14):以前列表/详情的手写 schema 和
 * 实际返回各自漂移(详情 stats 少了 4 个字段,handler 里还挂着 as never
 * 绕类型检查)。derive 一处,表改了 schema 跟着改。
 */
const questionFieldsSchema = selectQuestionsSchema
    .pick({
        id: true,
        title: true,
        type: true,
        difficulty: true,
        tags: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
    })
    .extend({
        // jsonb 列被 drizzle-zod 推成 any,openapi 文档会退化成 {},这里收窄
        tags: z.array(z.string()).nullable(),
    })

/**
 * 列表项的 stats。
 * 旧代码在用户没有该题记录时返回一份 not_started 的默认值(而不是 null),
 * 前端 questions-api.ts 的 QuestionStats 类型也把它当必填 —— 这里保持一致。
 * 这是 list handler 的聚合投影(coalesce 出来的计算列),不是表行,手写。
 */
const statsSchema = z.object({
    totalAttempts: z.number(),
    correctAttempts: z.number(),
    status: statusSchema,
    lastAttemptAt: z.date().nullable(),
})

const listItemSchema = questionFieldsSchema.extend({ stats: statsSchema })

const listResponseSchema = z.object({
    data: z.array(listItemSchema),
    total: z.number(),
    page: z.number(),
    size: z.number(),
})

/**
 * 详情比列表多 content / answer / lastAttempt。
 * stats 是 questionStats 表全行 —— handler 在"无统计记录"时也会返回一份
 * 全字段兜底行(见 questions.handlers.ts getOne),两条路径同用行 schema。
 */
const detailSchema = questionFieldsSchema
    .extend({
        content: z.string(),
        // 旧代码无条件返回 answer(注释写明"用于练习页面")
        answer: z.string(),
        stats: selectQuestionStatsSchema,
        lastAttempt: z
            .object({
                userAnswer: z.string().nullable(),
                isCorrect: z.boolean(),
                timeSpent: z.number().nullable(),
                createdAt: z.date(),
            })
            .nullable(),
    })

/** 查询参数:全部可选,对齐旧 Nest 的 @Query() 行为 */
const listQuerySchema = z.object({
    type: z.enum(['markdown', 'text']).optional(),
    difficulty: difficultySchema.optional(),
    tag: z.string().optional(),
    status: statusSchema.optional(),
    page: z.coerce.number().int().positive().default(1),
    size: z.coerce.number().int().positive().max(100).default(10),
    /** 排序字段,`-` 前缀表示倒序。支持 stats. 前缀走 question_stats */
    ordering: z.string().optional(),
    search: z.string().optional(),
})

const statsResponseSchema = z.object({
    total: z.number(),
    completed: z.number(),
    inProgress: z.number(),
    notStarted: z.number(),
    accuracy: z.number(),
    totalTime: z.number(),
})

const submitBodySchema = z.object({
    userAnswer: z.string().nullable().optional(),
    timeSpent: z.number().nullable().optional(),
})

const markCorrectBodySchema = z.object({ isCorrect: z.boolean() })

const attemptParamsSchema = z.object({
    id: z.string().uuid(),
    attemptId: z.string().uuid(),
})

export const list = createRoute({
    method: 'get',
    path: '/questions',
    tags,
    request: { query: listQuerySchema },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(listResponseSchema, '题目分页列表'),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
            createErrorSchema(listQuerySchema),
            '查询参数校验失败',
        ),
    },
})

export const getOne = createRoute({
    method: 'get',
    path: '/questions/{id}',
    tags,
    request: { params: IdParamsSchema },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(detailSchema, '题目详情'),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, '题目不存在'),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
            createErrorSchema(IdParamsSchema),
            'id 不是合法 uuid',
        ),
    },
})

export const create = createRoute({
    method: 'post',
    path: '/questions',
    tags,
    request: { body: jsonContentRequired(insertQuestionsSchema, '要创建的题目') },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(selectQuestionsSchema, '创建成功'),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
            createErrorSchema(insertQuestionsSchema),
            '参数校验失败',
        ),
    },
})

export const update = createRoute({
    method: 'put',
    path: '/questions/{id}',
    tags,
    request: {
        params: IdParamsSchema,
        body: jsonContentRequired(insertQuestionsSchema.partial(), '要更新的字段'),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(selectQuestionsSchema, '更新成功'),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, '题目不存在或无权修改'),
    },
})

export const remove = createRoute({
    method: 'delete',
    path: '/questions/{id}',
    tags,
    request: { params: IdParamsSchema },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            createMessageObjectSchema('success'),
            '删除成功',
        ),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(
            createMessageObjectSchema('Question not found'),
            '题目不存在',
        ),
    },
})

export const submit = createRoute({
    method: 'post',
    path: '/questions/{id}/submit',
    tags,
    request: {
        params: IdParamsSchema,
        body: jsonContentRequired(submitBodySchema, '提交的答案与用时'),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({
                attempt: z.object({
                    id: z.string().uuid(),
                    userAnswer: z.string().nullable(),
                    timeSpent: z.number().nullable(),
                    attemptCount: z.number(),
                    createdAt: z.date(),
                }),
                answer: z.string(),
                question: z.object({ title: z.string(), content: z.string() }),
            }),
            '记录一次作答,并返回参考答案',
        ),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, '题目不存在'),
    },
})

export const markCorrect = createRoute({
    method: 'patch',
    path: '/questions/{id}/attempts/{attemptId}',
    tags,
    request: {
        params: attemptParamsSchema,
        body: jsonContentRequired(markCorrectBodySchema, '人工判分结果'),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({ success: z.boolean(), stats: selectQuestionStatsSchema.nullable() }),
            '判分成功',
        ),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, '作答记录不存在'),
    },
})

export const getAttempts = createRoute({
    method: 'get',
    path: '/questions/{id}/attempts',
    tags,
    request: { params: IdParamsSchema },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.array(selectQuestionAttemptsSchema),
            '该题的作答历史,按时间倒序',
        ),
    },
})

export const getStats = createRoute({
    method: 'get',
    path: '/questions/stats',
    tags,
    responses: {
        [HttpStatusCodes.OK]: jsonContent(statsResponseSchema, '当前用户的整体练习统计'),
    },
})
// ============================================================
// handler 用的类型别名
// ============================================================

export type ListRoute = typeof list
export type GetOneRoute = typeof getOne
export type CreateRoute = typeof create
export type UpdateRoute = typeof update
export type RemoveRoute = typeof remove
export type SubmitRoute = typeof submit
export type MarkCorrectRoute = typeof markCorrect
export type GetAttemptsRoute = typeof getAttempts
export type GetStatsRoute = typeof getStats
