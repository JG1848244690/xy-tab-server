import { createHash } from 'node:crypto'
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'
import type {
    ListPublicQuestionsRoute,
    GetPublicQuestionRoute,
    ViewQuestionRoute,
    ListBanksRoute,
    GetBankRoute,
    ListTagsRoute,
    ListArticlesRoute,
    GetArticleRoute,
    SitemapDataRoute,
} from './public.routes.js'
import type { AppRouteHandler } from '../../lib/types.js'
import db from '../../db/index.js'
import {
    articles,
    banks,
    questionViews,
    questions,
    tagRegistry,
} from '../../db/schema.js'
import { HttpStatusCodes } from '../../lib/openapi.js'

/**
 * 公开读接口(面试站 P0,plan §2.2)
 *
 * 三条铁律:
 *  1. 只吐 status='approved'(审核链的最后一道闸)
 *  2. 响应里绝不出现 userId / created_by / 私密统计字段
 *  3. 过滤/分页全下推 SQL(1.6G 小服务器,内存留给 PG 自己用)
 */

/** 公开列表的公共过滤:approved + 可选 bank/tag */
function publicQuestionConditions(bank?: string, tag?: string) {
    const conditions = [eq(questions.status, 'approved')]
    if (bank) conditions.push(eq(banks.slug, bank))
    // 与该库共用的标签过滤:大小写无关(jsonb 元素逐个 lower 比对;
    // 题目 tags 是 'JavaScript' 这类原始大小写,tag_registry 存的是小写 slug 名)
    if (tag) {
        conditions.push(
            sql`exists (select 1 from jsonb_array_elements_text(${questions.tags}) t where lower(t) = lower(${tag}))`,
        )
    }
    return conditions
}

export const listQuestions: AppRouteHandler<ListPublicQuestionsRoute> = async (c) => {
    const { bank, tag, page, size } = c.req.valid('query')
    const conditions = publicQuestionConditions(bank, tag)

    const rows = await db
        .select({
            slug: questions.slug,
            title: questions.title,
            summary: questions.summary,
            type: questions.type,
            difficulty: questions.difficulty,
            tags: questions.tags,
            viewCount: questions.viewCount,
            publishedAt: questions.publishedAt,
            updatedAt: questions.updatedAt,
            bankSlug: banks.slug,
        })
        .from(questions)
        .leftJoin(banks, eq(questions.bankId, banks.id))
        .where(and(...conditions))
        .orderBy(desc(questions.publishedAt))
        .limit(size)
        .offset((page - 1) * size)

    const [{ value: total }] = await db
        .select({ value: count() })
        .from(questions)
        .leftJoin(banks, eq(questions.bankId, banks.id))
        .where(and(...conditions))

    return c.json(
        { data: rows.map((r) => ({ ...r, slug: r.slug! })), total: Number(total), page, size },
        HttpStatusCodes.OK,
    )
}

export const getQuestion: AppRouteHandler<GetPublicQuestionRoute> = async (c) => {
    const { slug } = c.req.valid('param')

    const [row] = await db
        .select({
            id: questions.id,
            slug: questions.slug,
            title: questions.title,
            summary: questions.summary,
            type: questions.type,
            difficulty: questions.difficulty,
            tags: questions.tags,
            content: questions.content,
            answer: questions.answer,
            viewCount: questions.viewCount,
            publishedAt: questions.publishedAt,
            updatedAt: questions.updatedAt,
            bankSlug: banks.slug,
        })
        .from(questions)
        .leftJoin(banks, eq(questions.bankId, banks.id))
        .where(and(eq(questions.slug, slug), eq(questions.status, 'approved')))
        .limit(1)

    if (!row) return c.json({ message: 'Not Found' }, HttpStatusCodes.NOT_FOUND)
    return c.json({ ...row, slug: row.slug! }, HttpStatusCodes.OK)
}

export const viewQuestion: AppRouteHandler<ViewQuestionRoute> = async (c) => {
    const { slug } = c.req.valid('param')

    // 浏览计数去重(S4 反爬):同一 IP 同一天同一题只计一次。
    // IP 取值与限流中间件同规则(cf-connecting-ip → x-real-ip → 对端);
    // 存 hash 不存裸 IP。先插 view_events(唯一约束兜重),插成功才 +1
    const ipHeader =
        c.req.header('cf-connecting-ip') ?? c.req.header('x-real-ip') ?? 'unknown'
    const day = new Date().toISOString().slice(0, 10)
    const ipHash = createHash('sha256')
        .update(`${ipHeader}:${day}`)
        .digest('hex')
        .slice(0, 32)

    const [approved] = await db
        .select({ id: questions.id })
        .from(questions)
        .where(and(eq(questions.slug, slug), eq(questions.status, 'approved')))
        .limit(1)
    if (!approved) return c.json({ message: 'Not Found' }, HttpStatusCodes.NOT_FOUND)

    const inserted = await db
        .insert(questionViews)
        .values({ questionId: approved.id, day, ipHash })
        .onConflictDoNothing()
        .returning({ id: questionViews.id })

    if (inserted.length) {
        await db
            .update(questions)
            .set({ viewCount: sql`${questions.viewCount} + 1` })
            .where(eq(questions.id, approved.id))
    }

    const [row] = await db
        .select({ viewCount: questions.viewCount })
        .from(questions)
        .where(eq(questions.id, approved.id))

    return c.json({ viewCount: row!.viewCount }, HttpStatusCodes.OK)
}

/** banks + 已发布题数;联表 group by 一次算完 */
export const listBanks: AppRouteHandler<ListBanksRoute> = async (c) => {
    const rows = await db
        .select({
            slug: banks.slug,
            title: banks.title,
            description: banks.description,
            cover: banks.cover,
            tags: banks.tags,
            updatedAt: banks.updatedAt,
            questionCount: count(questions.id),
        })
        .from(banks)
        .leftJoin(
            questions,
            and(eq(questions.bankId, banks.id), eq(questions.status, 'approved')),
        )
        .groupBy(banks.id)
        .orderBy(desc(banks.updatedAt))

    return c.json(
        { data: rows.map((r) => ({ ...r, questionCount: Number(r.questionCount) })) },
        HttpStatusCodes.OK,
    )
}

export const getBank: AppRouteHandler<GetBankRoute> = async (c) => {
    const { slug } = c.req.valid('param')

    const [bank] = await db.select().from(banks).where(eq(banks.slug, slug)).limit(1)
    if (!bank) return c.json({ message: 'Not Found' }, HttpStatusCodes.NOT_FOUND)

    const rows = await db
        .select({
            slug: questions.slug,
            title: questions.title,
            summary: questions.summary,
            type: questions.type,
            difficulty: questions.difficulty,
            tags: questions.tags,
            viewCount: questions.viewCount,
            publishedAt: questions.publishedAt,
            updatedAt: questions.updatedAt,
        })
        .from(questions)
        .where(and(eq(questions.bankId, bank.id), eq(questions.status, 'approved')))
        .orderBy(desc(questions.publishedAt))

    const [{ value: questionCount }] = await db
        .select({ value: count() })
        .from(questions)
        .where(and(eq(questions.bankId, bank.id), eq(questions.status, 'approved')))

    return c.json(
        {
            slug: bank.slug,
            title: bank.title,
            description: bank.description,
            cover: bank.cover,
            tags: bank.tags,
            updatedAt: bank.updatedAt,
            questionCount: Number(questionCount),
            questions: rows.map((r) => ({ ...r, slug: r.slug! })),
        },
        HttpStatusCodes.OK,
    )
}

/**
 * 标签聚合页:题目数按 tags @> [name] 统计(questions.tags 存的是标签名);
 * hasIntro = 介绍 ≥240 字,前端据此决定收录(真)还是 noindex(假)
 */
export const listTags: AppRouteHandler<ListTagsRoute> = async (c) => {
    const rows = await db
        .select({
            slug: tagRegistry.slug,
            name: tagRegistry.name,
            description: tagRegistry.description,
            questionCount: sql<number>`(
                select count(*) from "questions" q
                where q.status = 'approved'
                  and exists (
                      select 1 from jsonb_array_elements_text(q.tags) tag
                      where lower(tag) = lower(${tagRegistry.name})
                  )
            )`,
        })
        .from(tagRegistry)
        .orderBy(tagRegistry.name)

    return c.json(
        {
            data: rows.map((r) => ({
                ...r,
                questionCount: Number(r.questionCount),
                hasIntro: (r.description?.length ?? 0) >= 240,
            })),
        },
        HttpStatusCodes.OK,
    )
}

export const listArticles: AppRouteHandler<ListArticlesRoute> = async (c) => {
    const { kind, page, size } = c.req.valid('query')
    const conditions = [eq(articles.status, 'approved')]
    if (kind) conditions.push(eq(articles.kind, kind))

    const rows = await db
        .select({
            slug: articles.slug,
            title: articles.title,
            kind: articles.kind,
            excerpt: articles.excerpt,
            comment: articles.comment,
            externalUrl: articles.externalUrl,
            sourceDomain: articles.sourceDomain,
            tags: articles.tags,
            publishedAt: articles.publishedAt,
            viewCount: articles.viewCount,
            updatedAt: articles.updatedAt,
        })
        .from(articles)
        .where(and(...conditions))
        .orderBy(desc(articles.publishedAt))
        .limit(size)
        .offset((page - 1) * size)

    const [{ value: total }] = await db
        .select({ value: count() })
        .from(articles)
        .where(and(...conditions))

    return c.json({ data: rows, total: Number(total), page, size }, HttpStatusCodes.OK)
}

export const getArticle: AppRouteHandler<GetArticleRoute> = async (c) => {
    const { slug } = c.req.valid('param')

    const [row] = await db
        .select({
            slug: articles.slug,
            title: articles.title,
            kind: articles.kind,
            excerpt: articles.excerpt,
            externalUrl: articles.externalUrl,
            sourceDomain: articles.sourceDomain,
            contentMd: articles.contentMd,
            comment: articles.comment,
            relatedQuestionIds: articles.relatedQuestionIds,
            tags: articles.tags,
            publishedAt: articles.publishedAt,
            viewCount: articles.viewCount,
            updatedAt: articles.updatedAt,
        })
        .from(articles)
        .where(and(eq(articles.slug, slug), eq(articles.status, 'approved')))
        .limit(1)

    if (!row) return c.json({ message: 'Not Found' }, HttpStatusCodes.NOT_FOUND)

    // 内链:文章关联题目的公开 slug(题目必须也是 approved)
    let relatedQuestionSlugs: string[] = []
    if (row.relatedQuestionIds?.length) {
        const related = await db
            .select({ slug: questions.slug })
            .from(questions)
            .where(
                and(
                    inArray(questions.id, row.relatedQuestionIds),
                    eq(questions.status, 'approved'),
                ),
            )
        relatedQuestionSlugs = related.map((r) => r.slug!)
    }

    return c.json({ ...row, relatedQuestionSlugs }, HttpStatusCodes.OK)
}

/** 构建期全量导航:CI 的 SSG 构建 generateStaticParams/sitemap/RSS 都吃这一口 */
export const sitemapData: AppRouteHandler<SitemapDataRoute> = async (c) => {
    const [questionRows, bankRows, articleRows, tagRows] = await Promise.all([
        db
            .select({ slug: questions.slug, updatedAt: questions.updatedAt })
            .from(questions)
            .where(eq(questions.status, 'approved')),
        db.select({ slug: banks.slug, updatedAt: banks.updatedAt }).from(banks),
        db
            .select({ slug: articles.slug, updatedAt: articles.updatedAt })
            .from(articles)
            .where(eq(articles.status, 'approved')),
        db.select({ slug: tagRegistry.slug }).from(tagRegistry),
    ])

    return c.json(
        {
            questions: questionRows.map((r) => ({ ...r, slug: r.slug! })),
            banks: bankRows,
            articles: articleRows,
            tags: tagRows,
        },
        HttpStatusCodes.OK,
    )
}
