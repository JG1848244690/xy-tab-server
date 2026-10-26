/**
 * 图片统一管理 handler(2026-10-26)
 *
 * 文件落盘位置 = UPLOAD_DIR/YYYY/MM/<uuid>.<ext>,对外 URL = UPLOAD_PUBLIC_BASE/...
 * DB 只存元信息;「是否被引用」用 LIKE 扫描题目/文章正文实时算 —— 数据量小,
 * 换来的是零同步逻辑、永远不会出现"引用表和正文不一致"的问题。
 */
import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { and, count, desc, eq, gte, ilike, inArray, sql } from 'drizzle-orm'
import type {
    UploadRoute,
    ListRoute,
    RemoveRoute,
    CleanupRoute,
} from './media.routes.js'
import type { AppRouteHandler } from '../../lib/types.js'
import db from '../../db/index.js'
import { articles, mediaAssets, questions } from '../../db/schema.js'
import { HttpStatusCodes } from '../../lib/openapi.js'
import { adminOnly } from '../../middlewares/admin.js'
import {
    DAILY_UPLOAD_LIMIT,
    MAX_IMAGE_BYTES,
    uploadDir,
    uploadPublicBase,
} from './config.js'

/** 被题目/文章引用次数(0 = 孤儿图) */
const usageExpr = sql<number>`(
    (select count(*) from ${questions} q
      where q.content like '%' || ${mediaAssets.url} || '%'
         or q.answer  like '%' || ${mediaAssets.url} || '%')
  + (select count(*) from ${articles} a
      where a.content_md like '%' || ${mediaAssets.url} || '%'
         or a.comment    like '%' || ${mediaAssets.url} || '%')
)`

const assetColumns = {
    id: mediaAssets.id,
    url: mediaAssets.url,
    path: mediaAssets.path,
    mime: mediaAssets.mime,
    bytes: mediaAssets.bytes,
    uploadedBy: mediaAssets.uploadedBy,
    createdAt: mediaAssets.createdAt,
    usage: usageExpr,
}

/** 魔数识别:不信任客户端 content-type(改后缀/伪造就绕不过去) */
function sniffImage(buf: Buffer): { mime: string; ext: string } | null {
    if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return { mime: 'image/png', ext: 'png' }
    }
    if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
        return { mime: 'image/jpeg', ext: 'jpg' }
    }
    const head6 = buf.subarray(0, 6).toString('latin1')
    if (buf.length >= 6 && (head6 === 'GIF87a' || head6 === 'GIF89a')) {
        return { mime: 'image/gif', ext: 'gif' }
    }
    if (
        buf.length >= 12 &&
        buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
        buf.subarray(8, 12).toString('latin1') === 'WEBP'
    ) {
        return { mime: 'image/webp', ext: 'webp' }
    }
    return null
}

function sized(n: number | string | null | undefined): number {
    return Number(n ?? 0)
}

export const upload: AppRouteHandler<UploadRoute> = async (c) => {
    const userId = c.get('userId')!

    let form: FormData
    try {
        form = await c.req.formData()
    } catch {
        return c.json(
            { message: '请用 multipart/form-data 上传,字段名 file' },
            HttpStatusCodes.BAD_REQUEST,
        )
    }

    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) {
        return c.json({ message: '缺少 file 字段或文件为空' }, HttpStatusCodes.BAD_REQUEST)
    }
    if (file.size > MAX_IMAGE_BYTES) {
        return c.json(
            { message: `图片不能超过 ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB` },
            HttpStatusCodes.PAYLOAD_TOO_LARGE,
        )
    }

    // 每日上传配额(admin 豁免):按 UTC 天,和 AI 配额口径一致
    if (!adminOnly(c)) {
        const now = new Date()
        const dayStart = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
        )
        const [{ value: usedToday }] = await db
            .select({ value: count() })
            .from(mediaAssets)
            .where(
                and(
                    eq(mediaAssets.uploadedBy, userId),
                    gte(mediaAssets.createdAt, dayStart),
                ),
            )
        if (Number(usedToday) >= DAILY_UPLOAD_LIMIT) {
            return c.json(
                { message: `今日上传已达上限(${DAILY_UPLOAD_LIMIT} 张),明天再试` },
                HttpStatusCodes.TOO_MANY_REQUESTS,
            )
        }
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const kind = sniffImage(buf)
    if (!kind) {
        return c.json(
            { message: '仅支持 png / jpeg / webp / gif 图片' },
            HttpStatusCodes.UNSUPPORTED_MEDIA_TYPE,
        )
    }

    const now = new Date()
    const yyyy = String(now.getUTCFullYear())
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
    const rel = `${yyyy}/${mm}/${randomUUID()}.${kind.ext}`
    const full = join(uploadDir(), rel)
    const url = `${uploadPublicBase()}/${rel}`

    await mkdir(dirname(full), { recursive: true })
    await writeFile(full, buf)

    let row: {
        id: string
        url: string
        path: string
        mime: string
        bytes: number
        uploadedBy: string | null
        createdAt: Date
    }
    try {
        ;[row] = await db
            .insert(mediaAssets)
            .values({
                path: rel,
                url,
                mime: kind.mime,
                bytes: buf.length,
                uploadedBy: userId,
            })
            .returning({
                id: mediaAssets.id,
                url: mediaAssets.url,
                path: mediaAssets.path,
                mime: mediaAssets.mime,
                bytes: mediaAssets.bytes,
                uploadedBy: mediaAssets.uploadedBy,
                createdAt: mediaAssets.createdAt,
            })
    } catch (err) {
        // 落库失败时清掉刚写的文件,避免产生无记录的孤儿文件
        await unlink(full).catch(() => {})
        throw err
    }

    return c.json({ asset: { ...row, usage: 0 } }, HttpStatusCodes.OK)
}

export const list: AppRouteHandler<ListRoute> = async (c) => {
    if (!adminOnly(c)) {
        return c.json({ message: 'Forbidden' }, HttpStatusCodes.FORBIDDEN)
    }
    const { page, size, unused, search } = c.req.valid('query')
    const conditions = []
    if (search) conditions.push(ilike(mediaAssets.url, `%${search}%`))
    if (unused === '1') conditions.push(sql`${usageExpr} = 0`)
    const where = conditions.length ? and(...conditions) : undefined

    const rows = await db
        .select(assetColumns)
        .from(mediaAssets)
        .where(where)
        .orderBy(desc(mediaAssets.createdAt))
        .limit(size)
        .offset((page - 1) * size)

    const [{ value: total }] = await db
        .select({ value: count() })
        .from(mediaAssets)
        .where(where)

    const [{ value: all }] = await db.select({ value: count() }).from(mediaAssets)
    const [{ value: unusedCount }] = await db
        .select({ value: count() })
        .from(mediaAssets)
        .where(sql`${usageExpr} = 0`)

    return c.json(
        {
            data: rows.map((r) => ({ ...r, usage: sized(r.usage) })),
            total: Number(total),
            page,
            size,
            counts: { all: Number(all), unused: Number(unusedCount) },
        },
        HttpStatusCodes.OK,
    )
}

export const remove: AppRouteHandler<RemoveRoute> = async (c) => {
    if (!adminOnly(c)) {
        return c.json({ message: 'Forbidden' }, HttpStatusCodes.FORBIDDEN)
    }
    const { id } = c.req.valid('param')

    const [asset] = await db
        .select({ id: mediaAssets.id, path: mediaAssets.path, usage: usageExpr })
        .from(mediaAssets)
        .where(eq(mediaAssets.id, id))
        .limit(1)
    if (!asset) {
        return c.json({ message: 'Not Found' }, HttpStatusCodes.NOT_FOUND)
    }
    if (sized(asset.usage) > 0) {
        return c.json(
            { message: `图片仍被 ${sized(asset.usage)} 处内容引用,请先删除正文里的引用` },
            HttpStatusCodes.CONFLICT,
        )
    }

    await db.delete(mediaAssets).where(eq(mediaAssets.id, id))
    await unlink(join(uploadDir(), asset.path)).catch(() => {})
    return c.json({ message: 'success' }, HttpStatusCodes.OK)
}

export const cleanup: AppRouteHandler<CleanupRoute> = async (c) => {
    if (!adminOnly(c)) {
        return c.json({ message: 'Forbidden' }, HttpStatusCodes.FORBIDDEN)
    }
    // 一次最多清 500 张,避免长事务;没清完再点一次
    const stale = await db
        .select({ id: mediaAssets.id, path: mediaAssets.path })
        .from(mediaAssets)
        .where(sql`${usageExpr} = 0`)
        .limit(500)

    if (!stale.length) return c.json({ deleted: 0 }, HttpStatusCodes.OK)

    for (const row of stale) {
        await unlink(join(uploadDir(), row.path)).catch(() => {})
    }
    await db.delete(mediaAssets).where(
        inArray(
            mediaAssets.id,
            stale.map((r) => r.id),
        ),
    )
    return c.json({ deleted: stale.length }, HttpStatusCodes.OK)
}
