import { createRoute, z } from '@hono/zod-openapi'
import {
    HttpStatusCodes,
    createErrorSchema,
    jsonContent,
    jsonContentRequired,
} from '../../lib/openapi.js'
import { selectQuestionsSchema } from '../../db/schema.js'
import { notFoundSchema } from '../../lib/constants.js'

const tags = ['Review']

const IdParamsSchema = z.object({ id: z.string().uuid() })

/** 触发结果:202 = 已入队;skipped = 内容没改且已过审,不重审 */
const triggerResponseSchema = z.object({
    status: z.enum(['pending_review', 'skipped']),
})

/** /review/:id/result 的响应:题目当前审核态 + 最近一次审计 */
const resultResponseSchema = z.object({
    question: selectQuestionsSchema
        .pick({
            id: true,
            title: true,
            status: true,
            reviewScore: true,
            reviewResult: true,
            contentHash: true,
        })
        .nullable(),
    lastLog: z
        .object({
            verdict: z.string(),
            score: z.number().nullable(),
            report: z.record(z.string(), z.unknown()).nullable(),
            latencyMs: z.number().nullable(),
            createdAt: z.date(),
        })
        .nullable(),
})

/** 卡死检测:pending_review 超过 30 分钟的题目列表 */
const staleResponseSchema = z.object({
    stale: z.array(
        selectQuestionsSchema.pick({ id: true, title: true, updatedAt: true }),
    ),
    retriggered: z.number(),
})

export const triggerOne = createRoute({
    method: 'post',
    path: '/review/{id}',
    tags,
    request: { params: IdParamsSchema },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(triggerResponseSchema, '处理结果(入队或跳过)'),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, '题目不存在或无权操作'),
        [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
            z.object({ message: z.string() }),
            'LLM 未配置,审核 agent 不可用',
        ),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
            createErrorSchema(IdParamsSchema),
            'id 不是合法 uuid',
        ),
    },
})

export const triggerBatch = createRoute({
    method: 'post',
    path: '/review/batch',
    tags,
    request: {
        body: jsonContentRequired(
            z.object({ limit: z.number().int().min(1).max(20).default(10) }),
            '本次最多触发多少题(存量清洗用)',
        ),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({ triggered: z.number(), skipped: z.number() }),
            '批量触发结果',
        ),
        [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
            z.object({ message: z.string() }),
            'LLM 未配置,审核 agent 不可用',
        ),
    },
})

export const result = createRoute({
    method: 'get',
    path: '/review/{id}/result',
    tags,
    request: { params: IdParamsSchema },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(resultResponseSchema, '题目当前审核态与最近审计'),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, '题目不存在或无权查看'),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
            createErrorSchema(IdParamsSchema),
            'id 不是合法 uuid',
        ),
    },
})

export const stale = createRoute({
    method: 'get',
    path: '/review/stale',
    tags,
    responses: {
        [HttpStatusCodes.OK]: jsonContent(staleResponseSchema, '卡死题目列表(已自动重触发)'),
    },
})

// ============================================================
// handler 用的类型别名
// ============================================================

export type TriggerOneRoute = typeof triggerOne
export type TriggerBatchRoute = typeof triggerBatch
export type ResultRoute = typeof result
export type StaleRoute = typeof stale
