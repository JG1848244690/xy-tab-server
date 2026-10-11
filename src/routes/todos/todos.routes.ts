import { createRoute, z } from '@hono/zod-openapi'
import {
    HttpStatusCodes,
    createErrorSchema,
    jsonContent,
    jsonContentRequired,
} from '../../lib/openapi.js'
import { insertTodosSchema, selectTodosSchema } from '../../db/schema.js'

const tags = ['Todos']

const IdParamsSchema = z.object({ id: z.string().uuid() })

/** 前端 todos-api.ts 的 Todo 类型,字段名完全一致 */
const todoSchema = selectTodosSchema

const notFoundSchema = z.object({ message: z.string() })

export const getMonthStatus = createRoute({
    method: 'get',
    path: '/todos/month-status',
    tags,
    request: {
        query: z.object({
            year: z.coerce.number().int().min(1970).max(9999),
            month: z.coerce.number().int().min(1).max(12),
        }),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({ completed: z.array(z.string()), incomplete: z.array(z.string()) }),
            '该月有打卡的日期,按完成与否分成两组',
        ),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
            createErrorSchema(z.object({ year: z.number(), month: z.number() })),
            'year / month 参数非法',
        ),
    },
})

export const getByDate = createRoute({
    method: 'get',
    path: '/todos/by-date',
    tags,
    request: { query: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式须为 YYYY-MM-DD') }) },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.array(todoSchema),
            '覆盖该日期的所有 todo(含跨天事件),按开始时间升序',
        ),
    },
})

export const getByMonth = createRoute({
    method: 'get',
    path: '/todos/by-month',
    tags,
    request: {
        query: z.object({
            year: z.coerce.number().int().min(1970).max(9999),
            month: z.coerce.number().int().min(1).max(12),
        }),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.array(todoSchema),
            '与该月有交集的所有 todo(含跨天事件)',
        ),
    },
})

export const create = createRoute({
    method: 'post',
    path: '/todos',
    tags,
    request: { body: jsonContentRequired(insertTodosSchema, '要创建的 todo') },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(todoSchema, '创建成功'),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
            createErrorSchema(insertTodosSchema),
            '参数校验失败',
        ),
    },
})

export const update = createRoute({
    method: 'patch',
    path: '/todos/{id}',
    tags,
    request: {
        params: IdParamsSchema,
        body: jsonContentRequired(insertTodosSchema.partial(), '要更新的字段'),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(todoSchema, '更新成功'),
        [HttpStatusCodes.BAD_REQUEST]: jsonContent(notFoundSchema, 'Todo not found'),
    },
})

export const remove = createRoute({
    method: 'delete',
    path: '/todos/{id}',
    tags,
    request: { params: IdParamsSchema },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(z.object({ success: z.boolean() }), '删除成功'),
        [HttpStatusCodes.BAD_REQUEST]: jsonContent(notFoundSchema, 'Todo not found'),
    },
})

/** 只切 completed 状态,前端拿回 {id, completed} 两字段就够刷新 UI */
export const toggle = createRoute({
    method: 'patch',
    path: '/todos/{id}/toggle',
    tags,
    request: { params: IdParamsSchema },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({ id: z.string().uuid(), completed: z.boolean() }),
            '切换后的状态',
        ),
        [HttpStatusCodes.BAD_REQUEST]: jsonContent(notFoundSchema, 'Todo not found'),
    },
})
// ============================================================
// handler 用的类型别名
// ============================================================

export type GetMonthStatusRoute = typeof getMonthStatus
export type GetByDateRoute = typeof getByDate
export type GetByMonthRoute = typeof getByMonth
export type CreateRoute = typeof create
export type UpdateRoute = typeof update
export type RemoveRoute = typeof remove
export type ToggleRoute = typeof toggle
