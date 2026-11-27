import { z } from 'zod'
import { bodyLimit } from 'hono/body-limit'
import { createMiddleware } from 'hono/factory'
import env from '../../env.js'
import { ownsFileLibraries } from '../../lib/auth.js'
import { createRouter } from '../../lib/create-app.js'
import type { AppBindings } from '../../lib/types.js'
import { cookieAuth } from '../../middlewares/auth.js'
import { rateLimit } from '../../middlewares/rate-limit.js'
import { createFolder, listFiles, sendFile, uploadFile, uploadLimit } from './files.js'

const router = createRouter()
const requireOwner = createMiddleware<AppBindings>(async (c, next) => {
    c.header('Cache-Control', 'private, no-store')
    if (!ownsFileLibraries(c.get('userId'), c.get('userRole'))) return c.notFound()
    await next()
})
const requireMutation = createMiddleware<AppBindings>(async (c, next) => {
    if (c.req.header('X-Hls-File-Library') !== '1'
        || ['cross-site', 'same-site'].includes(c.req.header('Sec-Fetch-Site') ?? '')) {
        return c.json({ message: '请求来源无效。' }, 403)
    }
    await next()
})

const roots = { static: env.STATIC_LIBRARY_ROOT, private: env.PRIVATE_GALLERY_ROOT } as const
const listQuery = z.object({
    path: z.string().default(''),
    q: z.string().trim().max(100).default(''),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
})

router.use('/file-library/*', cookieAuth(), requireOwner)
router.get('/file-library/:library/list', async (c) => {
    const library = c.req.param('library')
    if (library !== 'static' && library !== 'private') return c.notFound()
    const input = listQuery.safeParse(c.req.query())
    if (!input.success) return c.json({ message: '筛选条件无效。' }, 400)
    const { path, q, page } = input.data
    return c.json(await listFiles(roots[library], path, q, page))
})

router.get('/file-library/:library/file', async (c) => {
    const library = c.req.param('library')
    if (library !== 'static' && library !== 'private') return c.notFound()
    return sendFile(roots[library], c.req.query('path') ?? '', c.req.query('preview') === '1', c.req.raw)
})

router.post('/file-library/static/folder', requireMutation, bodyLimit({ maxSize: 4096 }), async (c) => {
    const input = z.object({ path: z.string(), name: z.string() }).strict()
        .safeParse(await c.req.json().catch(() => undefined))
    if (!input.success) return c.json({ message: '文件夹信息无效。' }, 400)
    await createFolder(env.STATIC_LIBRARY_UPLOAD_ROOT, input.data.path, input.data.name)
    return c.body(null, 201)
})

router.post('/file-library/static/upload', requireMutation, rateLimit({ windowMs: 60_000, max: 30 }), async (c) => {
    const size = Number(c.req.header('Content-Length'))
    if (size > uploadLimit) return c.json({ message: '单个文件最多 48 MB。' }, 413)
    await uploadFile(env.STATIC_LIBRARY_UPLOAD_ROOT, c.req.query('path') ?? '', c.req.query('name') ?? '', c.req.raw)
    return c.body(null, 201)
})

export default router
