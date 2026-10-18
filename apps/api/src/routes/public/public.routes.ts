import { createRoute, z } from '@hono/zod-openapi'
import {
    HttpStatusCodes,
    createErrorSchema,
    jsonContent,
} from '../../lib/openapi.js'
import { selectArticlesSchema, selectBanksSchema } from '../../db/schema.js'

const tags = ['Public']

/** 公开读接口的公共校验失败响应 */
const invalidQuery = <T extends z.ZodTypeAny>(schema: T) =>
    jsonContent(createErrorSchema(schema), '查询参数校验失败')

const slugParamsSchema = z.object({ slug: z.string().min(1).max(255) })

/** 公开题目列表项:绝不包含 userId / created_by / 私密统计(plan §2.2 安全) */
const publicQuestionCoreSchema = z.object({
    slug: z.string(),
    title: z.string(),
    summary: z.string().nullable(),
    type: z.enum(['markdown', 'text']),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    tags: z.array(z.string()).nullable(),
    viewCount: z.number(),
    publishedAt: z.date().nullable(),
    updatedAt: z.date(),
})

/** 列表项多带 bankSlug(站点侧做内链) */
const publicQuestionItemSchema = publicQuestionCoreSchema.extend({
    bankSlug: z.string().nullable(),
})

const publicQuestionListSchema = z.object({
    data: z.array(publicQuestionItemSchema),
    total: z.number(),
    page: z.number(),
    size: z.number(),
})

/** 详情:面试站题目页要展示题干+答案+解析(原创化产物) */
const publicQuestionDetailSchema = publicQuestionItemSchema.extend({
    content: z.string(),
    answer: z.string(),
})

const publicListQuerySchema = z.object({
    bank: z.string().optional(),
    tag: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    size: z.coerce.number().int().positive().max(50).default(20),
})

const publicBankItemSchema = selectBanksSchema.pick({
    slug: true,
    title: true,
    description: true,
    cover: true,
    tags: true,
    updatedAt: true,
}).extend({
    questionCount: z.number(),
})

const publicArticleItemSchema = selectArticlesSchema.pick({
    slug: true,
    title: true,
    kind: true,
    excerpt: true,
    externalUrl: true,
    sourceDomain: true,
    tags: true,
    publishedAt: true,
    viewCount: true,
    updatedAt: true,
})

const publicTagsSchema = z.object({
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    /** 介绍 ≥240 字才允许聚合页被收录;false 时站点侧 noindex */
    hasIntro: z.boolean(),
    questionCount: z.number(),
})

/** sitemap/RSS/构建期用的全量导航数据 */
const sitemapDataSchema = z.object({
    questions: z.array(z.object({ slug: z.string(), updatedAt: z.date() })),
    banks: z.array(z.object({ slug: z.string(), updatedAt: z.date() })),
    articles: z.array(z.object({ slug: z.string(), updatedAt: z.date() })),
    tags: z.array(z.object({ slug: z.string() })),
})

export const listQuestions = createRoute({
    method: 'get',
    path: '/public/questions',
    tags,
    request: { query: publicListQuerySchema },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(publicQuestionListSchema, '已发布题目分页列表'),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: invalidQuery(publicListQuerySchema),
    },
})

export const getQuestion = createRoute({
    method: 'get',
    path: '/public/questions/{slug}',
    tags,
    request: { params: slugParamsSchema },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(publicQuestionDetailSchema, '已发布题目详情(含答案)'),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(
            z.object({ message: z.string() }),
            'slug 不存在或未发布',
        ),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: invalidQuery(slugParamsSchema),
    },
})

export const viewQuestion = createRoute({
    method: 'post',
    path: '/public/questions/{slug}/view',
    tags,
    request: { params: slugParamsSchema },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({ viewCount: z.number() }),
            '浏览计数 +1(轻量 PV,MVP 不做严格去重)',
        ),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(
            z.object({ message: z.string() }),
            'slug 不存在或未发布',
        ),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: invalidQuery(slugParamsSchema),
    },
})

export const listBanks = createRoute({
    method: 'get',
    path: '/public/banks',
    tags,
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({ data: z.array(publicBankItemSchema) }),
            '题库/合集列表(带已发布题目数)',
        ),
    },
})

export const getBank = createRoute({
    method: 'get',
    path: '/public/banks/{slug}',
    tags,
    request: { params: slugParamsSchema },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            publicBankItemSchema.extend({
                // 库内题都在本 bank 下,不需要 bankSlug 字段
                questions: z.array(publicQuestionCoreSchema),
            }),
            '题库详情 + 该库全部已发布题',
        ),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(
            z.object({ message: z.string() }),
            'slug 不存在',
        ),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: invalidQuery(slugParamsSchema),
    },
})

export const listTags = createRoute({
    method: 'get',
    path: '/public/tags',
    tags,
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({ data: z.array(publicTagsSchema) }),
            '标签聚合页数据(带介绍完整度与题目数)',
        ),
    },
})

export const listArticles = createRoute({
    method: 'get',
    path: '/public/articles',
    tags,
    request: {
        query: z.object({
            kind: z.enum(['own', 'curated']).optional(),
            page: z.coerce.number().int().positive().default(1),
            size: z.coerce.number().int().positive().max(50).default(20),
        }),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({
                data: z.array(publicArticleItemSchema),
                total: z.number(),
                page: z.number(),
                size: z.number(),
            }),
            '文章列表(own 原创图文 / curated 导读卡)',
        ),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: invalidQuery(
            z.object({ kind: z.enum(['own', 'curated']) }),
        ),
    },
})

export const getArticle = createRoute({
    method: 'get',
    path: '/public/articles/{slug}',
    tags,
    request: { params: slugParamsSchema },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            publicArticleItemSchema.extend({
                // own:正文 markdown;curated:点评
                contentMd: z.string().nullable(),
                comment: z.string().nullable(),
                relatedQuestionSlugs: z.array(z.string()),
            }),
            '文章详情',
        ),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(
            z.object({ message: z.string() }),
            'slug 不存在或未发布',
        ),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: invalidQuery(slugParamsSchema),
    },
})

export const sitemapData = createRoute({
    method: 'get',
    path: '/public/sitemap-data',
    tags,
    responses: {
        [HttpStatusCodes.OK]: jsonContent(sitemapDataSchema, '构建期全量导航数据(sitemap/RSS 用)'),
    },
})

// ============================================================
// handler 用的类型别名
// ============================================================

export type ListPublicQuestionsRoute = typeof listQuestions
export type GetPublicQuestionRoute = typeof getQuestion
export type ViewQuestionRoute = typeof viewQuestion
export type ListBanksRoute = typeof listBanks
export type GetBankRoute = typeof getBank
export type ListTagsRoute = typeof listTags
export type ListArticlesRoute = typeof listArticles
export type GetArticleRoute = typeof getArticle
export type SitemapDataRoute = typeof sitemapData
