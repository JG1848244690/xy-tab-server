import { randomUUID } from 'node:crypto'
import { and, asc, count, eq, ilike, inArray } from 'drizzle-orm'
import type {
    CreateCollectionRoute,
    GetCollectionRoute,
    ListCollectionsRoute,
    RemoveCollectionRoute,
    SetCollectionArticlesRoute,
    UpdateCollectionRoute,
} from './collections.routes.js'
import type { AppRouteHandler } from '../../lib/types.js'
import db from '../../db/index.js'
import { articles, collectionArticles, collections } from '../../db/schema.js'
import { HttpStatusCodes } from '../../lib/openapi.js'
import { errorBody } from '../../lib/errors.js'

/** 23505 = unique_violation */
function isUniqueViolation(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505'
}

export const list: AppRouteHandler<ListCollectionsRoute> = async (c) => {
    const { status, q, page, size } = c.req.valid('query')
    const conditions = []
    if (status) conditions.push(eq(collections.status, status))
    if (q) conditions.push(ilike(collections.title, `%${q}%`))
    const where = conditions.length ? and(...conditions) : undefined

    const [rows, [{ value: total }]] = await Promise.all([
        db
            .select({
                collection: collections,
                articleCount: count(collectionArticles.articleId),
            })
            .from(collections)
            .leftJoin(collectionArticles, eq(collectionArticles.collectionId, collections.id))
            .where(where)
            .groupBy(collections.id)
            .orderBy(asc(collections.sort), asc(collections.title))
            .limit(size)
            .offset((page - 1) * size),
        db.select({ value: count() }).from(collections).where(where),
    ])

    return c.json(
        {
            data: rows.map((r) => ({ ...r.collection, articleCount: Number(r.articleCount) })),
            total: Number(total),
            page,
            size,
        },
        HttpStatusCodes.OK,
    )
}

export const get: AppRouteHandler<GetCollectionRoute> = async (c) => {
    const { id } = c.req.valid('param')

    const [collection] = await db.select().from(collections).where(eq(collections.id, id)).limit(1)
    if (!collection) return c.json({ message: 'Not Found' }, HttpStatusCodes.NOT_FOUND)

    const items = await db
        .select({
            id: articles.id,
            slug: articles.slug,
            title: articles.title,
            kind: articles.kind,
            status: articles.status,
            publishedAt: articles.publishedAt,
            sort: collectionArticles.sort,
        })
        .from(collectionArticles)
        .innerJoin(articles, eq(articles.id, collectionArticles.articleId))
        .where(eq(collectionArticles.collectionId, id))
        .orderBy(asc(collectionArticles.sort), asc(articles.title))

    return c.json({ collection, articles: items }, HttpStatusCodes.OK)
}

export const create: AppRouteHandler<CreateCollectionRoute> = async (c) => {
    const body = c.req.valid('json')
    const slug = body.slug ?? `c-${randomUUID().replace(/-/g, '').slice(0, 8)}`

    try {
        const [created] = await db
            .insert(collections)
            .values({
                slug,
                title: body.title.trim(),
                description: body.description?.trim() || null,
                cover: body.cover?.trim() || null,
                sort: body.sort,
                status: body.status,
            })
            .returning()

        return c.json(created!, HttpStatusCodes.OK)
    } catch (err) {
        if (isUniqueViolation(err)) {
            return c.json(errorBody('Slug exists', 'CONFLICT'), HttpStatusCodes.CONFLICT)
        }
        throw err
    }
}

export const update: AppRouteHandler<UpdateCollectionRoute> = async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')

    const [existing] = await db.select().from(collections).where(eq(collections.id, id)).limit(1)
    if (!existing) return c.json({ message: 'Not Found' }, HttpStatusCodes.NOT_FOUND)

    try {
        const [updated] = await db
            .update(collections)
            .set({
                title: body.title?.trim() ?? existing.title,
                slug: body.slug ?? existing.slug,
                description:
                    body.description !== undefined
                        ? body.description?.trim() || null
                        : existing.description,
                cover: body.cover !== undefined ? body.cover?.trim() || null : existing.cover,
                sort: body.sort ?? existing.sort,
                status: body.status ?? existing.status,
            })
            .where(eq(collections.id, id))
            .returning()

        return c.json(updated!, HttpStatusCodes.OK)
    } catch (err) {
        if (isUniqueViolation(err)) {
            return c.json(errorBody('Slug exists', 'CONFLICT'), HttpStatusCodes.CONFLICT)
        }
        throw err
    }
}

export const remove: AppRouteHandler<RemoveCollectionRoute> = async (c) => {
    const { id } = c.req.valid('param')
    const deleted = await db.delete(collections).where(eq(collections.id, id)).returning({
        id: collections.id,
    })
    if (!deleted.length) return c.json({ message: 'Not Found' }, HttpStatusCodes.NOT_FOUND)
    return c.json({ ok: true }, HttpStatusCodes.OK)
}

export const setArticles: AppRouteHandler<SetCollectionArticlesRoute> = async (c) => {
    const { id } = c.req.valid('param')
    const { articleIds } = c.req.valid('json')

    const [collection] = await db
        .select({ id: collections.id })
        .from(collections)
        .where(eq(collections.id, id))
        .limit(1)
    if (!collection) return c.json({ message: 'Not Found' }, HttpStatusCodes.NOT_FOUND)

    // 去重(保留首次出现的顺序)
    const ordered = [...new Set(articleIds)]

    if (ordered.length) {
        const found = await db
            .select({ id: articles.id })
            .from(articles)
            .where(inArray(articles.id, ordered))
        if (found.length !== ordered.length) {
            return c.json(
                errorBody('Article not found', 'INVALID_ARTICLE'),
                HttpStatusCodes.BAD_REQUEST,
            )
        }
    }

    await db.transaction(async (tx) => {
        await tx.delete(collectionArticles).where(eq(collectionArticles.collectionId, id))
        if (ordered.length) {
            await tx.insert(collectionArticles).values(
                ordered.map((articleId, index) => ({
                    collectionId: id,
                    articleId,
                    sort: index,
                })),
            )
        }
        // 合集内容变了,更新时间要跟着动(前台 SSG 靠 updatedAt 判断是否重建)
        await tx.update(collections).set({ updatedAt: new Date() }).where(eq(collections.id, id))
    })

    return c.json({ ok: true, count: ordered.length }, HttpStatusCodes.OK)
}
