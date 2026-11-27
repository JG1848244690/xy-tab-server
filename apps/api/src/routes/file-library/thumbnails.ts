import { lstat } from 'node:fs/promises'
import sharp from 'sharp'
import { AppError } from '../../lib/errors.js'
import { fileSegments, mimeOf, within } from './files.js'

const thumbnailTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
const cacheLimit = 24 * 1024 * 1024
const thumbnails = new Map<string, Buffer>()
const pending = new Map<string, Promise<Buffer>>()
let cacheSize = 0

function remember(key: string, bytes: Buffer) {
    thumbnails.set(key, bytes)
    cacheSize += bytes.length
    for (const [oldKey, oldBytes] of thumbnails) {
        if (cacheSize <= cacheLimit) break
        thumbnails.delete(oldKey)
        cacheSize -= oldBytes.length
    }
}

function thumbnail(key: string, path: string) {
    const cached = thumbnails.get(key)
    if (cached) {
        thumbnails.delete(key)
        thumbnails.set(key, cached)
        return cached
    }
    const existing = pending.get(key)
    if (existing) return existing

    const job = sharp(path, { limitInputPixels: 64_000_000, autoOrient: true })
        .resize(360, 360, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 68 })
        .timeout({ seconds: 10 })
        .toBuffer()
        .then((bytes) => {
            remember(key, bytes)
            return bytes
        })
        .catch(() => { throw new AppError('无法生成缩略图。', 422, 'THUMBNAIL_UNAVAILABLE') })
        .finally(() => pending.delete(key))
    pending.set(key, job)
    return job
}

export async function sendThumbnail(root: string, path: string, head: boolean) {
    const segments = fileSegments(path)
    const name = segments.at(-1)
    const full = await within(root, segments)
    const info = await lstat(full).catch(() => undefined)
    if (!name || !info?.isFile()) throw new AppError('文件不存在。', 404, 'NOT_FOUND')
    if (!thumbnailTypes.has(mimeOf(name))) {
        throw new AppError('此文件格式暂不支持缩略图。', 415, 'UNSUPPORTED_MEDIA_TYPE')
    }

    const key = JSON.stringify([full, info.ino, info.size, info.mtimeMs, info.ctimeMs])
    const bytes = await thumbnail(key, full)
    return new Response(head ? null : new Uint8Array(bytes), {
        headers: {
            'Content-Type': 'image/webp',
            'Content-Length': String(bytes.length),
            'Cache-Control': 'private, no-store',
            'Cross-Origin-Resource-Policy': 'same-origin',
            'X-Content-Type-Options': 'nosniff',
        },
    })
}
