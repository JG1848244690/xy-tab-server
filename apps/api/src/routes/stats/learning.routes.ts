import { createRoute, z } from '@hono/zod-openapi'
import { createErrorSchema, HttpStatusCodes, jsonContent, jsonContentRequired } from '../../lib/openapi.js'

const rank = z.object({ alias: z.string(), days: z.number(), rank: z.number(), isMe: z.boolean() })
const pagination = z.object({ page: z.coerce.number().int().positive().max(100_000).default(1) })
const preference = z.object({ enabled: z.boolean() })

export const learning = createRoute({
    method: 'get',
    path: '/stats/learning',
    tags: ['Stats'],
    request: { query: pagination },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(z.object({
            today: z.string(),
            week: z.array(z.object({ date: z.string(), completed: z.boolean() })),
            streak: z.number(),
            enabled: z.boolean(),
            canJoin: z.boolean(),
            myRank: rank.nullable(),
            leaderboard: z.array(rank),
            hasMore: z.boolean(),
        }), '个人学习打卡与学习周榜'),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(pagination), '分页参数无效'),
    },
})

export const learningPreference = createRoute({
    method: 'put',
    path: '/stats/learning/leaderboard',
    tags: ['Stats'],
    request: { body: jsonContentRequired(preference, '参与学习周榜') },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(preference, '学习周榜参与状态'),
        [HttpStatusCodes.FORBIDDEN]: jsonContent(z.object({ message: z.string() }), '需要验证邮箱'),
    },
})
