import { z } from 'zod'
import { bodyLimit } from 'hono/body-limit'
import { createMiddleware } from 'hono/factory'
import { createRouter } from '../../lib/create-app.js'
import type { AppBindings } from '../../lib/types.js'
import { cookieAuth } from '../../middlewares/auth.js'
import { rateLimit } from '../../middlewares/rate-limit.js'
import { createMcpKey, listMcpKeys, revokeMcpKey } from './mcp-keys.js'

const keyInput = z.object({
    name: z.string().trim().min(1).max(80),
    access: z.enum(['read', 'read_write']),
    expiresInDays: z.union([z.literal(7), z.literal(30), z.literal(90)]),
}).strict()
const router = createRouter()

const noStore = createMiddleware<AppBindings>(async (c, next) => {
    c.header('Cache-Control', 'private, no-store')
    await next()
})

const requireManagementRequest = createMiddleware<AppBindings>(async (c, next) => {
    if (c.req.header('X-Hls-Mcp-Management') !== '1'
        || ['cross-site', 'same-site'].includes(c.req.header('Sec-Fetch-Site') ?? '')) {
        return c.json({ message: 'Invalid management request' }, 403)
    }
    await next()
})

router.get('/mcp-keys', noStore, cookieAuth(), async (c) => c.json(await listMcpKeys(c.get('userId')!)))

router.post(
    '/mcp-keys',
    noStore,
    requireManagementRequest,
    rateLimit({ windowMs: 60_000, max: 20 }),
    cookieAuth(),
    bodyLimit({ maxSize: 4096 }),
    async (c) => {
        const input = keyInput.safeParse(await c.req.json().catch(() => undefined))
        if (!input.success) return c.json({ message: '请检查密钥名称、权限和有效期。' }, 400)

        const key = await createMcpKey(c.get('userId')!, input.data)
        if (!key) return c.json({ message: '每个账号最多保留 20 把密钥，请先撤销不再使用的密钥。' }, 409)
        c.get('logger')?.info({ userId: c.get('userId'), keyId: key.id }, 'MCP key created')
        return c.json(key, 201)
    },
)

router.delete('/mcp-keys/:id', noStore, requireManagementRequest, cookieAuth(), async (c) => {
    const id = z.string().uuid().safeParse(c.req.param('id'))
    if (!id.success) return c.json({ message: '密钥不存在。' }, 404)

    const removed = await revokeMcpKey(c.get('userId')!, id.data)
    if (!removed) return c.json({ message: '密钥不存在。' }, 404)
    c.get('logger')?.info({ userId: c.get('userId'), keyId: removed.id }, 'MCP key revoked')
    return c.body(null, 204)
})

export default router
