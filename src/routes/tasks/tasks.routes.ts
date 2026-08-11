import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent, jsonContentOneOf, jsonContentRequired } from 'stoker/openapi/helpers'

import { selectTasksSchema, insertTaskSchema, patchTasksSchema } from '../../db/schema.js'
import { createErrorSchema, IdParamsSchema } from 'stoker/openapi/schemas'
import { notFoundSchema } from '../../lib/constants.js'

const tags = ["Tasks"]

export const list = createRoute({
    path: '/tasks',
    method: 'get',
    tags,
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.array(selectTasksSchema),
            'The list of tasks',
        )
    }
})

export const create = createRoute({
    path: '/tasks',
    method: 'post',
    request: {
        body: jsonContentRequired(
            insertTaskSchema,
            'the task to create'
        )
    },
    tags,
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            selectTasksSchema,
            'The created task',
        ),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
            createErrorSchema(insertTaskSchema),
            "The validation error(s)"
        ),
    }
})

export const getOne = createRoute({
    path: '/tasks/{id}',
    method: 'get',
    request: {
        params: IdParamsSchema,
    },
    tags,
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            selectTasksSchema,
            'The requested task',
        ),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(
            notFoundSchema,
            'not found'
        ),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
            createErrorSchema(insertTaskSchema),
            "invaild id error(s)"
        ),
    }
})


export const patch = createRoute({
    path: '/tasks/{id}',
    method: 'patch',
    request: {
        params: IdParamsSchema,
        body: jsonContentRequired(
            patchTasksSchema,
            'the task to updates'
        )
    },
    tags,
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            selectTasksSchema,
            'The created task',
        ),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(
            notFoundSchema,
            'not found'
        ),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContentOneOf(
            [
                createErrorSchema(patchTasksSchema),
                (createErrorSchema(IdParamsSchema)),
            ],
            "The validation error(s)"
        ),
    }
})


export const remove = createRoute({
    path: '/tasks/{id}',
    method: 'delete',
    request: {
        params: IdParamsSchema,
    },
    tags,
    responses: {
        [HttpStatusCodes.NO_CONTENT]: {
            description: 'The task was deleted',
        },
        [HttpStatusCodes.NOT_FOUND]: jsonContent(
            notFoundSchema,
            'not found'
        ),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
            createErrorSchema(IdParamsSchema),
            "invalid id error(s)"
        ),
    }
})


export type ListRoute = typeof list;
export type CreateRoute = typeof create;
export type GetOneRoute = typeof getOne;
export type PatchRoute = typeof patch;
export type RemoveRoute = typeof remove;