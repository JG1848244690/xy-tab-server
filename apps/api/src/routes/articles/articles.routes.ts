import { createRoute, z } from '@hono/zod-openapi'
import {
    HttpStatusCodes,
    createErrorSchema,
    createMessageObjectSchema,
    jsonContent,
    jsonContentRequired,
} from '../../lib/openapi.js'
import { selectArticlesSchema } from '../../db/schema.js'
import { notFoundSchema } from '../../lib/constants.js'

const tags = ['Articles']

const IdParamsSchema = z.object({ id: z.string().uuid() })

/** 列表/详情:不返回创建者、审核内部字段 */
const articleItemSchema = selectArticlesSchema.omit({
    createdBy: true,
    reviewScore: true,
    reviewResult: true,
    contentHash: true,
})

const slugSchema = z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug 只能是小写字母、数字和连字符')

/**
 * 原创用 contentMd,荐文用 externalUrl + comment。
 * draft 也允许先存不完整内容,但发布(approved)时必须有正文/外链。
 */
const articleBodySchema = z
    .object({
        kind: z.enum(['own', 'curated']).default('own'),
        // 荐文可以只给 URL,标题由服务端抓取 / 从域名兜底
        title: z.string().max(255).optional(),
        slug: slugSchema.optional(),
        excerpt: z.string().max(600).optional(),
        contentMd: z.string().optional(),
        externalUrl: z.string().url().max(1000).optional(),
        sourceDomain: z.string().max(255).optional(),
        comment: z.string().max(2000).optional(),
        tags: z.array(z.string().max(50)).max(20).optional(),
        relatedQuestionIds: z.array(z.string().uuid()).max(20).optional(),
        status: z.enum(['draft', 'approved']).default('draft'),
    })
    .superRefine((value, ctx) => {
        if (value.kind === 'own' && !value.title?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['title'],
                message: '原创文章必须有标题',
            })
        }
        if (value.status !== 'approved') return
        if (value.kind === 'own' && !value.contentMd?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['contentMd'],
                message: '原创文章发布前必须有正文',
            })
        }
        if (value.kind === 'curated' && !value.externalUrl) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['externalUrl'],
                message: '荐文发布前必须有外链',
            })
        }
    })

const articleUpdateSchema = z.object({
    title: z.string().min(1).max(255).optional(),
    slug: slugSchema.optional(),
    excerpt: z.string().max(600).nullable().optional(),
    contentMd: z.string().nullable().optional(),
    externalUrl: z.string().url().max(1000).nullable().optional(),
    sourceDomain: z.string().max(255).nullable().optional(),
    comment: z.string().max(2000).nullable().optional(),
    tags: z.array(z.string().max(50)).max(20).nullable().optional(),
    relatedQuestionIds: z.array(z.string().uuid()).max(20).nullable().optional(),
    status: z.enum(['draft', 'approved']).optional(),
})

export const listArticles = createRoute({
    method: 'get',
    path: '/articles',
    tags,
    request: {
        query: z.object({
            kind: z.enum(['own', 'curated']).optional(),
            status: z.enum(['draft', 'pending_review', 'approved', 'rejected']).optional(),
            q: z.string().optional(),
            page: z.coerce.number().int().positive().default(1),
            size: z.coerce.number().int().positive().max(50).default(20),
        }),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({
                data: z.array(articleItemSchema),
                total: z.number(),
                page: z.number(),
                size: z.number(),
            }),
            '文章列表(含草稿)',
        ),
    },
})

export const createArticle = createRoute({
    method: 'post',
    path: '/articles',
    tags,
    request: { body: jsonContentRequired(articleBodySchema, '文章内容') },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(articleItemSchema, '创建成功'),
        [HttpStatusCodes.BAD_REQUEST]: jsonContent(
            createMessageObjectSchema('Invalid article'),
            '缺少标题或链接',
        ),
        [HttpStatusCodes.CONFLICT]: jsonContent(createMessageObjectSchema('Slug exists'), 'slug 已存在'),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
            createErrorSchema(articleBodySchema),
            '参数校验失败',
        ),
    },
})

export const updateArticle = createRoute({
    method: 'patch',
    path: '/articles/{id}',
    tags,
    request: {
        params: IdParamsSchema,
        body: jsonContentRequired(articleUpdateSchema, '要更新的字段'),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(articleItemSchema, '更新成功'),
        [HttpStatusCodes.BAD_REQUEST]: jsonContent(
            createMessageObjectSchema('Invalid article'),
            '发布前内容不完整',
        ),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, '文章不存在'),
        [HttpStatusCodes.CONFLICT]: jsonContent(createMessageObjectSchema('Slug exists'), 'slug 已存在'),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
            createErrorSchema(articleUpdateSchema),
            '参数校验失败',
        ),
    },
})

export const removeArticle = createRoute({
    method: 'delete',
    path: '/articles/{id}',
    tags,
    request: { params: IdParamsSchema },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(z.object({ ok: z.boolean() }), '已删除'),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, '文章不存在'),
    },
})

export type ListArticlesRoute = typeof listArticles
export type CreateArticleRoute = typeof createArticle
export type UpdateArticleRoute = typeof updateArticle
export type RemoveArticleRoute = typeof removeArticle
