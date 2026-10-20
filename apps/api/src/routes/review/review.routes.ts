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

/** 人工审核队列条目 */
const queueItemSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
    slug: z.string().nullable(),
    status: z.string(),
    reviewScore: z.number().nullable(),
    reviewResult: z.record(z.string(), z.unknown()).nullable(),
    updatedAt: z.date(),
    latestLog: z
        .object({
            verdict: z.string(),
            score: z.number().nullable(),
            source: z.string(),
            note: z.string().nullable(),
            createdAt: z.date(),
        })
        .nullable(),
})

/** 人工裁决:驳回必须给理由(服务端强制) */
const humanDecisionBodySchema = z
    .object({
        decision: z.enum(['approve', 'reject']),
        note: z.string().min(1).max(500).optional(),
    })
    .superRefine((v, ctx) => {
        if (v.decision === 'reject' && !v.note) {
            ctx.addIssue({
                code: 'custom',
                path: ['note'],
                message: '驳回必须填写理由',
            })
        }
    })

/** 触发结果:入队 / skipped(内容没改且已过审,或人工驳回后未改内容) */
const triggerResponseSchema = z.object({
    status: z.enum(['pending_review', 'skipped']),
    /** 触发后的配额状态(用户可见,防滥用文档 §1) */
    quota: z
        .object({
            used: z.number(),
            limit: z.number(),
            remaining: z.number(),
        })
        .optional(),
})

/** 配额查询(出题人可见自己的用量) */
export const quota = createRoute({
    method: 'get',
    path: '/review/quota',
    tags,
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({
                used: z.number(),
                limit: z.number(),
                remaining: z.number(),
                limited: z.boolean(),
                resetAt: z.string(),
                /** admin 豁免配额 */
                exempt: z.boolean(),
            }),
            '当前用户今日 AI 审核配额',
        ),
    },
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
        [HttpStatusCodes.TOO_MANY_REQUESTS]: jsonContent(
            z.object({ message: z.string() }),
            '今日 AI 审核配额已用完(见 GET /review/quota)',
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

/** 人工审核队列(admin only):pending = AI 过了等人审;rejected = 被 AI 打回 */
export const queue = createRoute({
    method: 'get',
    path: '/review/queue',
    tags,
    request: {
        query: z.object({
            tab: z.enum(['pending', 'rejected']).default('pending'),
            page: z.coerce.number().int().positive().default(1),
            size: z.coerce.number().int().positive().max(50).default(20),
        }),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({
                data: z.array(queueItemSchema),
                total: z.number(),
                page: z.number(),
                size: z.number(),
            }),
            '人工审核队列',
        ),
        [HttpStatusCodes.FORBIDDEN]: jsonContent(
            z.object({ message: z.string() }),
            '仅 admin 可见',
        ),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
            createErrorSchema(z.object({ tab: z.enum(['pending', 'rejected']) })),
            '参数非法',
        ),
    },
})

/** 人工裁决(admin only):通过 → approved(公开站可见);驳回 → rejected */
export const humanDecision = createRoute({
    method: 'post',
    path: '/review/{id}/human',
    tags,
    request: {
        params: IdParamsSchema,
        body: jsonContentRequired(humanDecisionBodySchema, '裁决结果'),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({
                success: z.boolean(),
                status: z.string(),
                publishedAt: z.date().nullable(),
            }),
            '裁决完成',
        ),
        [HttpStatusCodes.FORBIDDEN]: jsonContent(
            z.object({ message: z.string() }),
            '仅 admin 可裁决',
        ),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, '题目不存在'),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
            createErrorSchema(humanDecisionBodySchema),
            '参数非法(驳回必须填理由)',
        ),
    },
})

// ============================================================
// handler 用的类型别名
// ============================================================

export type TriggerOneRoute = typeof triggerOne
export type TriggerBatchRoute = typeof triggerBatch
export type ResultRoute = typeof result
export type StaleRoute = typeof stale
export type QueueRoute = typeof queue
export type HumanDecisionRoute = typeof humanDecision
export type QuotaRoute = typeof quota
