import { randomUUID } from 'node:crypto'
import { and, count, desc, eq, ilike } from 'drizzle-orm'
import type {
    CreateArticleRoute,
    ListArticlesRoute,
    RemoveArticleRoute,
    UpdateArticleRoute,
} from './articles.routes.js'
import type { AppRouteHandler } from '../../lib/types.js'
import db from '../../db/index.js'
import { articles } from '../../db/schema.js'
import { HttpStatusCodes } from '../../lib/openapi.js'
import { errorBody } from '../../lib/errors.js'

type ArticleRow = typeof articles.$inferSelect

function toItem(row: ArticleRow) {
    const { createdBy: _createdBy, reviewScore: _s, reviewResult: _r, contentHash: _c, ...item } = row
    return item
}

/** 从 Markdown 里抽一段纯文本摘要(去代码块/图片/标记) */
function autoExcerpt(md: string): string {
    return md
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/[#>*_`~\-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 140)
}

function domainOf(url?: string | null): string | null {
    if (!url) return null
    try {
        return new URL(url).hostname
    } catch {
        return null
    }
}

/** drizzle 会把 PG 错误包一层,cause.code 才是 23505 */
function isUniqueViolation(err: unknown): boolean {
    const code =
        (err as { code?: string })?.code ??
        (err as { cause?: { code?: string } })?.cause?.code
    return code === '23505'
}

function decodeEntities(input: string): string {
    return input
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

/**
 * 只给一个 URL 时,尽量抓网页标题/描述。
 * 4 秒超时 + 只读前 200KB;失败就用域名兜底,绝不让收藏链接失败。
 */
async function fetchLinkMeta(url: string): Promise<{ title?: string; description?: string }> {
    try {
        const res = await fetch(url, {
            redirect: 'follow',
            signal: AbortSignal.timeout(4000),
            headers: {
                'user-agent':
                    'Mozilla/5.0 (compatible; XuyanLinkBot/1.0; +https://code.kskbl.com.cn)',
            },
        })
        if (!res.ok) return {}
        const type = res.headers.get('content-type') ?? ''
        if (!type.includes('text/html')) return {}
        const html = (await res.text()).slice(0, 200_000)

        const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)
        const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
        const desc =
            html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i) ??
            html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)

        return {
            title: decodeEntities(ogTitle?.[1] ?? titleTag?.[1] ?? '').slice(0, 255) || undefined,
            description: desc ? decodeEntities(desc[1]).slice(0, 300) : undefined,
        }
    } catch {
        return {}
    }
}

function fallbackTitle(url: string): string {
    try {
        const u = new URL(url)
        const last = u.pathname.split('/').filter(Boolean).pop()
        return last ? `${u.hostname} · ${decodeURIComponent(last)}`.slice(0, 255) : u.hostname
    } catch {
        return '未命名链接'
    }
}

export const list: AppRouteHandler<ListArticlesRoute> = async (c) => {
    const { kind, status, q, page, size } = c.req.valid('query')
    const conditions = []
    if (kind) conditions.push(eq(articles.kind, kind))
    if (status) conditions.push(eq(articles.status, status))
    if (q) conditions.push(ilike(articles.title, `%${q}%`))

    const where = conditions.length ? and(...conditions) : undefined

    const [rows, [{ value: total }]] = await Promise.all([
        db
            .select()
            .from(articles)
            .where(where)
            .orderBy(desc(articles.updatedAt))
            .limit(size)
            .offset((page - 1) * size),
        db.select({ value: count() }).from(articles).where(where),
    ])

    return c.json(
        { data: rows.map(toItem), total: Number(total), page, size },
        HttpStatusCodes.OK,
    )
}

export const create: AppRouteHandler<CreateArticleRoute> = async (c) => {
    const userId = c.get('userId')!
    const body = c.req.valid('json')

    // 荐文允许「只给 URL」:先抓标题/描述,抓不到就用域名+路径兜底
    let meta: { title?: string; description?: string } = {}
    const givenTitle = body.title?.trim() ?? ''
    if (!givenTitle && body.kind === 'curated' && body.externalUrl) {
        meta = await fetchLinkMeta(body.externalUrl)
    }
    const title =
        givenTitle ||
        meta.title ||
        (body.externalUrl ? fallbackTitle(body.externalUrl) : '')

    if (!title) {
        return c.json(errorBody('缺少标题或链接', 'INVALID_ARTICLE'), HttpStatusCodes.BAD_REQUEST)
    }

    const slug = body.slug ?? `a-${randomUUID().replace(/-/g, '').slice(0, 8)}`
    const excerpt =
        body.excerpt?.trim() ||
        meta.description ||
        (body.kind === 'own' ? autoExcerpt(body.contentMd ?? '') : null)
    const sourceDomain =
        body.sourceDomain?.trim() ||
        (body.kind === 'curated' ? domainOf(body.externalUrl) : null)

    try {
        const [created] = await db
            .insert(articles)
            .values({
                slug,
                title,
                kind: body.kind,
                excerpt: excerpt || null,
                contentMd: body.kind === 'own' ? (body.contentMd ?? null) : null,
                externalUrl: body.kind === 'curated' ? (body.externalUrl ?? null) : null,
                sourceDomain,
                comment: body.comment ?? null,
                tags: body.tags ?? null,
                relatedQuestionIds: body.relatedQuestionIds ?? null,
                status: body.status,
                publishedAt: body.status === 'approved' ? new Date() : null,
                createdBy: userId,
            })
            .returning()

        return c.json(toItem(created!), HttpStatusCodes.OK)
    } catch (err) {
        // 23505 = unique_violation(articles_slug_idx)
        if (isUniqueViolation(err)) {
            return c.json(errorBody('Slug exists', 'CONFLICT'), HttpStatusCodes.CONFLICT)
        }
        throw err
    }
}

export const update: AppRouteHandler<UpdateArticleRoute> = async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')

    const [existing] = await db.select().from(articles).where(eq(articles.id, id)).limit(1)
    if (!existing) return c.json({ message: 'Not Found' }, HttpStatusCodes.NOT_FOUND)

    const kind = existing.kind
    const nextStatus = body.status ?? existing.status
    const contentMd = body.contentMd !== undefined ? body.contentMd : existing.contentMd
    const externalUrl =
        body.externalUrl !== undefined ? body.externalUrl : existing.externalUrl

    if (nextStatus === 'approved') {
        if (kind === 'own' && !contentMd?.trim()) {
            return c.json(
                errorBody('原创文章发布前必须有正文', 'INVALID_ARTICLE'),
                HttpStatusCodes.BAD_REQUEST,
            )
        }
        if (kind === 'curated' && !externalUrl) {
            return c.json(
                errorBody('荐文发布前必须有外链', 'INVALID_ARTICLE'),
                HttpStatusCodes.BAD_REQUEST,
            )
        }
    }

    const excerpt =
        body.excerpt !== undefined
            ? body.excerpt
            : kind === 'own' && body.contentMd !== undefined
              ? autoExcerpt(body.contentMd ?? '') || null
              : existing.excerpt

    const sourceDomain =
        body.sourceDomain !== undefined
            ? body.sourceDomain
            : kind === 'curated' && body.externalUrl !== undefined
              ? domainOf(body.externalUrl)
              : existing.sourceDomain

    try {
        const [updated] = await db
            .update(articles)
            .set({
                title: body.title?.trim() ?? existing.title,
                slug: body.slug ?? existing.slug,
                excerpt,
                contentMd,
                externalUrl,
                sourceDomain,
                comment: body.comment !== undefined ? body.comment : existing.comment,
                tags: body.tags !== undefined ? body.tags : existing.tags,
                relatedQuestionIds:
                    body.relatedQuestionIds !== undefined
                        ? body.relatedQuestionIds
                        : existing.relatedQuestionIds,
                status: nextStatus,
                // 首次发布时写发布时间;重新上线不覆盖第一次
                publishedAt:
                    nextStatus === 'approved'
                        ? (existing.publishedAt ?? new Date())
                        : existing.publishedAt,
            })
            .where(eq(articles.id, id))
            .returning()

        return c.json(toItem(updated!), HttpStatusCodes.OK)
    } catch (err) {
        if (isUniqueViolation(err)) {
            return c.json(errorBody('Slug exists', 'CONFLICT'), HttpStatusCodes.CONFLICT)
        }
        throw err
    }
}

export const remove: AppRouteHandler<RemoveArticleRoute> = async (c) => {
    const { id } = c.req.valid('param')
    const [deleted] = await db.delete(articles).where(eq(articles.id, id)).returning({ id: articles.id })
    if (!deleted) return c.json({ message: 'Not Found' }, HttpStatusCodes.NOT_FOUND)
    return c.json({ ok: true }, HttpStatusCodes.OK)
}
