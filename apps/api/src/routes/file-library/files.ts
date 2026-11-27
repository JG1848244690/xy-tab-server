import { constants, createWriteStream } from 'node:fs'
import { mkdir, open, readdir, realpath, lstat, link, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { extname, join, resolve } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { AppError } from '../../lib/errors.js'

const mediaTypes: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
    '.webp': 'image/webp', '.avif': 'image/avif', '.bmp': 'image/bmp',
    '.heic': 'image/heic', '.heif': 'image/heif',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
    '.pdf': 'application/pdf', '.zip': 'application/zip',
}

export const uploadLimit = 48 * 1024 * 1024
export const mimeOf = (name: string) => mediaTypes[extname(name).toLowerCase()] ?? 'application/octet-stream'
const missing = () => new AppError('文件或文件夹不存在。', 404, 'NOT_FOUND')
const invalidPath = () => new AppError('路径或名称无效。', 400, 'INVALID_PATH')

export function fileSegment(name: string) {
    if (!name || Buffer.byteLength(name) > 240 || name !== name.trim() || name.startsWith('.')
        || name.endsWith('.') || /[\\/:*?"<>|\x00-\x1f\x7f]/.test(name)) throw invalidPath()
    return name
}

export function fileSegments(path: string) {
    if (path.length > 4096) throw invalidPath()
    return path ? path.split('/').map(fileSegment) : []
}

async function within(root: string, segments: string[]) {
    if (!root) throw missing()
    const realRoot = await realpath(resolve(root)).catch(() => { throw missing() })
    const target = join(realRoot, ...segments)
    const physical = await realpath(target).catch(() => { throw missing() })
    // These roots contain regular media. Reject symlinks, including links within a root.
    if (physical !== target) throw missing()
    return physical
}

function displayable(name: string) {
    try { fileSegment(name); return true } catch { return false }
}

export async function listFiles(root: string, path: string, query: string, page: number) {
    const folder = await within(root, fileSegments(path))
    const entries = await readdir(folder, { withFileTypes: true }).catch(() => { throw missing() })
    const keyword = query.toLowerCase()
    const filtered = entries.filter((entry) => (entry.isFile() || entry.isDirectory())
        && displayable(entry.name) && entry.name.toLowerCase().includes(keyword))
    filtered.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory())
        || a.name.localeCompare(b.name, 'zh-CN', { numeric: true }) || (a.name < b.name ? -1 : a.name === b.name ? 0 : 1))
    const pageSize = 48
    const items = await Promise.all(filtered.slice((page - 1) * pageSize, page * pageSize).map(async (entry) => {
        const metadata = await lstat(join(folder, entry.name)).catch(() => undefined)
        if (!metadata || (!metadata.isFile() && !metadata.isDirectory())) return null
        return {
            name: entry.name,
            path: path ? path + '/' + entry.name : entry.name,
            directory: entry.isDirectory(),
            mime: entry.isDirectory() ? null : mimeOf(entry.name),
            bytes: entry.isDirectory() ? null : metadata.size,
        }
    }))
    return { items: items.filter((item) => item !== null), total: filtered.length, pageSize }
}

function disposition(name: string, inline: boolean) {
    const encoded = encodeURIComponent(name).replace(/[!'()*]/g, (value) => '%' + value.charCodeAt(0).toString(16))
    return `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encoded}`
}

function byteRange(header: string, size: number): [number, number] | undefined {
    const match = /^bytes=(\d*)-(\d*)$/.exec(header)
    if (!match || (!match[1] && !match[2]) || size === 0) return undefined
    const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
    const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) return undefined
    return [start, end]
}

export async function sendFile(root: string, path: string, preview: boolean, request: Request) {
    const segments = fileSegments(path)
    const name = segments.at(-1)
    if (!name) throw missing()
    const mime = mimeOf(name)
    const inline = preview && /^(image|video)\//.test(mime)
    if (preview && !inline) throw new AppError('此文件仅支持下载。', 415, 'UNSUPPORTED_MEDIA_TYPE')
    const full = await within(root, segments)
    const handle = await open(full, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0))
        .catch(() => { throw missing() })
    try {
        const info = await handle.stat()
        if (!info.isFile()) throw missing()
        const headers = new Headers({
            'Accept-Ranges': 'bytes', 'Content-Type': mime, 'Content-Disposition': disposition(name, inline),
            'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store',
            'Cross-Origin-Resource-Policy': 'same-origin', 'Content-Security-Policy': "sandbox; default-src 'none'",
            'X-Accel-Buffering': 'no',
        })
        const rangeHeader = request.headers.get('Range')
        const range = rangeHeader ? byteRange(rangeHeader, info.size) : undefined
        if (rangeHeader && !range) {
            await handle.close()
            headers.set('Content-Range', `bytes */${info.size}`)
            return new Response(null, { status: 416, headers })
        }
        if (range) headers.set('Content-Range', `bytes ${range[0]}-${range[1]}/${info.size}`)
        headers.set('Content-Length', String(range ? range[1] - range[0] + 1 : info.size))
        if (request.method === 'HEAD' || !info.size) {
            await handle.close()
            return new Response(null, { status: range ? 206 : 200, headers })
        }
        const stream = handle.createReadStream(range ? { start: range[0], end: range[1] } : undefined)
        return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status: range ? 206 : 200, headers })
    } catch (error) {
        await handle.close()
        throw error
    }
}

const heifBrands = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs', 'mif1', 'msf1'])
const isHeif = (b: Buffer) => b.toString('ascii', 4, 8) === 'ftyp' && heifBrands.has(b.toString('ascii', 8, 12))

const uploadSignatures: Record<string, (bytes: Buffer) => boolean> = {
    'image/jpeg': (b) => b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
    'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    'image/gif': (b) => ['GIF87a', 'GIF89a'].includes(b.toString('ascii', 0, 6)),
    'image/webp': (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
    'image/heic': isHeif,
    'image/heif': isHeif,
    'application/pdf': (b) => b.toString('ascii', 0, 5) === '%PDF-',
    'application/zip': (b) => b.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 3, 4]))
        || b.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 5, 6])),
    'video/mp4': (b) => b.toString('ascii', 4, 8) === 'ftyp',
    'video/quicktime': (b) => b.toString('ascii', 4, 8) === 'ftyp',
    'video/webm': (b) => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
}

export function publicUploadPath(path: string) {
    const segments = fileSegments(path)
    if (segments[0] !== 'assets') throw new AppError('只可写入 assets 文件夹。', 403, 'FORBIDDEN')
    return segments.slice(1)
}

export async function createFolder(root: string, path: string, name: string) {
    const target = join(await within(root, publicUploadPath(path)), fileSegment(name))
    await mkdir(target).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'EEXIST') throw new AppError('同名文件或文件夹已存在。', 409, 'NAME_CONFLICT')
        throw error
    })
}

export async function uploadFile(root: string, path: string, name: string, request: Request) {
    const verify = uploadSignatures[mimeOf(fileSegment(name))]
    if (!verify || !request.body) throw new AppError('请选择支持的图片、视频、PDF 或 ZIP 文件。', 415, 'UNSUPPORTED_MEDIA_TYPE')
    const folder = await within(root, publicUploadPath(path))
    const temporary = join(folder, '.upload-' + randomUUID())
    const prefix = Buffer.alloc(16)
    let total = 0
    const limit = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
            chunk.copy(prefix, Math.min(total, prefix.length), 0, Math.max(0, prefix.length - total))
            total += chunk.length
            if (total > uploadLimit) callback(new AppError('单个文件最多 48 MB。', 413, 'FILE_TOO_LARGE'))
            else callback(null, chunk)
        },
    })
    try {
        await pipeline(Readable.fromWeb(request.body as Parameters<typeof Readable.fromWeb>[0]),
            limit, createWriteStream(temporary, { flags: 'wx', mode: 0o644 }))
        if (!verify(prefix.subarray(0, Math.min(total, prefix.length)))) {
            throw new AppError('文件内容和扩展名不匹配。', 415, 'UNSUPPORTED_MEDIA_TYPE')
        }
        // A same-filesystem hard link publishes the complete file atomically without overwriting.
        await link(temporary, join(folder, name)).catch((error: NodeJS.ErrnoException) => {
            if (error.code === 'EEXIST') throw new AppError('同名文件或文件夹已存在。', 409, 'NAME_CONFLICT')
            throw error
        })
    } finally {
        await unlink(temporary).catch(() => undefined)
    }
}
