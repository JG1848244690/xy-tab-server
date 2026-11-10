import { createRoute, z } from '@hono/zod-openapi'
import {
    HttpStatusCodes,
    createErrorSchema,
    createMessageObjectSchema,
    jsonContent,
    jsonContentRequired,
} from '../../lib/openapi.js'
import { selectCollectionsSchema } from '../../db/schema.js'
import { notFoundSchema } from '../../lib/constants.js'

const tags = ['Collections']

const IdParamsSchema = z.object({ id: z.string().uuid() })

const slugSchema = z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug 只能是小写字母、数字和连字符')

/** 合集对外字段(后台管理用,含 status) */
const collectionItemSchema = selectCollectionsSchema

const createBodySchema = z.object({
    title: z.string().min(1).max(255),
    slug: slugSchema.optional(),
    description: z.string().max(4000).optional(),
    cover: z.string().max(500).optional(),
    sort: z.coerce.number().int().default(0),
    status: z.enum(['draft', 'approved']).default('draft'),
})

const updateBodySchema = z.object({
    title: z.string().min(1).max(255).optional(),
    slug: slugSchema.optional(),
    description: z.string().max(4000).nullable().optional(),
    cover: z.string().max(500).nullable().optional(),
    sort: z.coerce.number().int().optional(),
    status: z.enum(['draft', 'approved']).optional(),
})

/** 合集内的文章(按 sort 排序) */
const collectionArticleSchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    title: z.string(),
    kind: z.enum(['own', 'curated']),
    status: z.string(),
    publishedAt: z.date().nullable(),
    sort: z.number(),
})

export const listCollections = createRoute({
    method: 'get',
    path: '/collections',
    tags,
    request: {
        query: z.object({
            status: z.enum(['draft', 'approved', 'pending_review', 'rejected']).optional(),
            q: z.string().optional(),
            page: z.coerce.number().int().positive().default(1),
            size: z.coerce.number().int().positive().max(50).default(20),
        }),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({
                data: z.array(collectionItemSchema.extend({ articleCount: z.number() })),
                total: z.number(),
                page: z.number(),
                size: z.number(),
            }),
            '合集列表(含草稿)',
        ),
    },
})

export const getCollection = createRoute({
    method: 'get',
    path: '/collections/{id}',
    tags,
    request: { params: IdParamsSchema },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({
                collection: collectionItemSchema,
                articles: z.array(collectionArticleSchema),
            }),
            '合集详情 + 有序文章列表',
        ),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, '合集不存在'),
    },
})

export const createCollection = createRoute({
    method: 'post',
    path: '/collections',
    tags,
    request: { body: jsonContentRequired(createBodySchema, '合集内容') },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(collectionItemSchema, '创建成功'),
        [HttpStatusCodes.CONFLICT]: jsonContent(createMessageObjectSchema('Slug exists'), 'slug 已存在'),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
            createErrorSchema(createBodySchema),
            '参数校验失败',
        ),
    },
})

export const updateCollection = createRoute({
    method: 'patch',
    path: '/collections/{id}',
    tags,
    request: {
        params: IdParamsSchema,
        body: jsonContentRequired(updateBodySchema, '要更新的字段'),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(collectionItemSchema, '更新成功'),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, '合集不存在'),
        [HttpStatusCodes.CONFLICT]: jsonContent(createMessageObjectSchema('Slug exists'), 'slug 已存在'),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
            createErrorSchema(updateBodySchema),
            '参数校验失败',
        ),
    },
})

export const removeCollection = createRoute({
    method: 'delete',
    path: '/collections/{id}',
    tags,
    request: { params: IdParamsSchema },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(z.object({ ok: z.boolean() }), '已删除'),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, '合集不存在'),
    },
})

/** 整体替换合集内的文章顺序(后台拖拽排序后一次提交) */
export const setCollectionArticles = createRoute({
    method: 'put',
    path: '/collections/{id}/articles',
    tags,
    request: {
        params: IdParamsSchema,
        body: jsonContentRequired(
            z.object({ articleIds: z.array(z.string().uuid()).max(200) }),
            '按顺序排列的文章 id',
        ),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({ ok: z.boolean(), count: z.number() }),
            '已保存顺序',
        ),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, '合集不存在'),
        [HttpStatusCodes.BAD_REQUEST]: jsonContent(
            createMessageObjectSchema('Article not found'),
            '有文章不存在',
        ),
    },
})

export type ListCollectionsRoute = typeof listCollections
export type GetCollectionRoute = typeof getCollection
export type CreateCollectionRoute = typeof createCollection
export type UpdateCollectionRoute = typeof updateCollection
export type RemoveCollectionRoute = typeof removeCollection
export type SetCollectionArticlesRoute = typeof setCollectionArticles
