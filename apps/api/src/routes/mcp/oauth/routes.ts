import { randomBytes, timingSafeEqual } from 'node:crypto'
import { RESPONSE_ALREADY_SENT } from '@hono/node-server/utils/response'
import { and, desc, eq } from 'drizzle-orm'
import { bodyLimit } from 'hono/body-limit'
import { getCookie, setCookie } from 'hono/cookie'
import type { Context } from 'hono'
import { z } from 'zod'
import db from '../../../db/index.js'
import { mcpOAuthGrants, users } from '../../../db/schema.js'
import { readAuthCookie, verifyToken } from '../../../lib/auth.js'
import { createRouter } from '../../../lib/create-app.js'
import type { AppBindings } from '../../../lib/types.js'
import { cookieAuth } from '../../../middlewares/auth.js'
import { rateLimit } from '../../../middlewares/rate-limit.js'
import { revokeGrant } from './adapter.js'
import { grantLifetime, oauth, scopes } from './config.js'
import { delegate, oauthProvider, providerRequest } from './provider.js'

type C = Context<AppBindings>
const router = createRouter()
const interactionId = /^[A-Za-z0-9_-]{16,128}$/
const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]!)

function page(c: C, title: string, content: string, status: 200 | 400 | 403 = 200, callbackOrigin = '') {
    c.header('Content-Security-Policy', `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${callbackOrigin}; frame-ancestors 'none'; base-uri 'none'`)
    c.header('Cache-Control', 'no-store')
    c.header('Referrer-Policy', 'same-origin')
    return c.html(`<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · 序言</title>
<style>body{font:16px/1.6 system-ui,sans-serif;background:#f4f1eb;color:#29251f;margin:0}main{max-width:32rem;margin:clamp(1rem,10vh,6rem) auto;padding:2rem;background:#fffdf8;border:1px solid #ddd5c8;border-radius:12px}button{font:inherit;cursor:pointer;padding:.45rem 1rem;border:1px solid #80786b;border-radius:6px;background:#fff;color:inherit;margin:.5rem .5rem 0 0}button[value=allow]{background:#29251f;color:white}p{overflow-wrap:anywhere}label{display:block;margin:.8rem 0}</style>
<main><h1>${title}</h1>${content}</main></html>`, status)
}

async function sessionUser(c: C) {
    const token = readAuthCookie(c)
    const id = token && await verifyToken(token)
    if (!id) return undefined
    const [user] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, id)).limit(1)
    return user
}

if (oauth) {
    const config = oauth
    const interactionPath = config.publicPrefix + '/oauth/interaction/'
    const csrfCookie = (uid: string) => `${config.secure ? '__Host-' : ''}hlse-oauth-${uid}`
    const expired = (c: C) => page(c, '授权请求已失效', '<p>请回到发起连接的客户端重新登录。</p>', 400)
    const cookieOptions = { secure: config.secure, httpOnly: true, sameSite: 'Strict' as const, path: '/' }

    const metadata = (c: C) => c.json({
        resource: config.resource,
        authorization_servers: [config.issuer],
        scopes_supported: scopes,
        bearer_methods_supported: ['header'],
        resource_name: 'hlsEdu 待办',
    })
    router.get(config.metadataPath, metadata)
    router.get('/.well-known/oauth-protected-resource', metadata)

    async function protocol(c: C, path: string) {
        const provider = oauthProvider()
        const request = c.env?.incoming
        const response = c.env?.outgoing
        if (!provider || !request || !response) return c.notFound()
        await delegate(provider, providerRequest(request, path), response)
        return RESPONSE_ALREADY_SENT
    }

    router.get('/.well-known/oauth-authorization-server', (c) => protocol(c, '/.well-known/openid-configuration'))
    router.get('/.well-known/openid-configuration', (c) => protocol(c, '/.well-known/openid-configuration'))
    router.get('/oauth/jwks', (c) => protocol(c, config.publicPrefix + '/oauth/jwks'))
    router.get('/oauth/authorize', rateLimit({ windowMs: 60_000, max: 60 }), (c) => {
        const url = new URL(c.req.url)
        const requested = url.searchParams.get('scope')?.split(/\s+/).filter((scope) => scope && scope !== 'openid') ?? []
        const allowed: string[] = [...scopes, 'offline_access']
        if (requested.some((scope) => !allowed.includes(scope))) {
            return page(c, '授权范围无效', '<p>客户端只能申请待办权限。</p>', 400)
        }
        if (!requested.includes(scopes[0])) requested.unshift(scopes[0])
        if (!url.searchParams.has('scope')) requested.push(scopes[1], 'offline_access')
        url.searchParams.set('scope', [...new Set(requested)].join(' '))
        return protocol(c, config.publicPrefix + '/oauth/authorize' + url.search)
    })
    // The provider resumes a signed interaction cookie at its own /authorize/:uid URL.
    router.get('/oauth/authorize/:uid', (c) => {
        const uid = c.req.param('uid')
        if (!interactionId.test(uid)) return c.notFound()
        return protocol(c, config.publicPrefix + '/oauth/authorize/' + uid)
    })
    for (const action of ['register', 'token', 'revoke'] as const) {
        router.post('/oauth/' + action, rateLimit({ windowMs: 60_000, max: action === 'register' ? 20 : 60 }),
            (c) => protocol(c, config.publicPrefix + '/oauth/' + action))
    }

    async function getInteraction(c: C, uid: string) {
        const provider = oauthProvider()
        if (!provider || !c.env?.incoming || !c.env?.outgoing || !interactionId.test(uid)) return undefined
        const request = providerRequest(c.env.incoming, interactionPath + uid)
        try {
            const details = await provider.interactionDetails(request, c.env.outgoing)
            if (details.uid === uid && !details.result) return { provider, request, response: c.env.outgoing, details }
        } catch {
            // Missing, expired or mismatched interaction cookie.
        }
        return undefined
    }

    async function showConsent(c: C, uid: string, clientId: string, requested: string, email: string, redirectUri: string) {
        const client = await oauthProvider()?.Client.find(clientId)
        const label = client?.clientName || '外部 MCP 客户端'
        const csrf = randomBytes(24).toString('base64url')
        setCookie(c, csrfCookie(uid), csrf, { ...cookieOptions, maxAge: 600 })
        const writeChoice = requested.split(' ').includes(scopes[1])
            ? '<label><input type="checkbox" name="write" value="yes"> 允许创建和完成我的待办</label>' : ''
        return page(c, '连接到 hlsEdu', `<p>${escape(label)} 请求访问 <strong>${escape(email)}</strong> 的待办。</p>
<form method="post" action="${interactionPath}${uid}">
<input type="hidden" name="csrf" value="${csrf}">
<p>允许后，客户端可以读取你的待办。</p>${writeChoice}
<p>你可以在个人设置中随时撤销授权。</p>
<button name="decision" value="allow">允许</button><button name="decision" value="deny">拒绝</button></form>`, 200,
            // Chromium also applies form-action to the final redirect after submitting.
            new URL(redirectUri).origin)
    }

    router.get('/oauth/interaction/:uid', async (c) => {
        const uid = c.req.param('uid')
        const interaction = await getInteraction(c, uid)
        if (!interaction) return expired(c)
        const user = await sessionUser(c)
        if (!user) return c.redirect('/login?mcp_oauth=' + encodeURIComponent(uid), 303)
        return showConsent(c, uid, String(interaction.details.params.client_id), String(interaction.details.params.scope ?? ''),
            user.email, String(interaction.details.params.redirect_uri))
    })

    router.post('/oauth/interaction/:uid', bodyLimit({ maxSize: 4096 }), async (c) => {
        const uid = c.req.param('uid')
        if (!interactionId.test(uid)) return expired(c)
        const form = await c.req.parseBody()
        const expected = getCookie(c, csrfCookie(uid))
        const actual = form.csrf
        const origin = c.req.header('Origin')
        const sameOrigin = origin === config.issuer
            || ((!origin || origin === 'null') && c.req.header('Sec-Fetch-Site') === 'same-origin')
        if (!sameOrigin || !expected || typeof actual !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(actual)
            || expected.length !== actual.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) {
            return page(c, '授权表单无效', '<p>请重新打开授权页。</p>', 403)
        }
        const interaction = await getInteraction(c, uid)
        const user = await sessionUser(c)
        if (!interaction || !user) return expired(c)
        const { provider, request, response, details } = interaction
        const finish = async (result: Parameters<typeof provider.interactionResult>[2]) => {
            setCookie(c, csrfCookie(uid), '', { ...cookieOptions, maxAge: 0 })
            return c.redirect(await provider.interactionResult(request, response, result, { mergeWithLastSubmission: false }), 303)
        }
        if (form.decision === 'deny') return finish({ error: 'access_denied', error_description: 'The user denied access' })
        if (form.decision !== 'allow') return expired(c)

        const clientId = String(details.params.client_id)
        const [client, existing] = await Promise.all([
            provider.Client.find(clientId),
            db.select({ id: mcpOAuthGrants.id }).from(mcpOAuthGrants).where(eq(mcpOAuthGrants.interactionId, uid)).limit(1),
        ])
        if (!client || existing.length) return expired(c)
        const requested = String(details.params.scope ?? '').split(' ')
        const granted = [scopes[0]] as string[]
        if (requested.includes(scopes[1]) && form.write === 'yes') granted.push(scopes[1])
        const grant = new provider.Grant({ accountId: user.id, clientId })
        grant.addResourceScope(config.resource, granted.join(' '))
        grant.addOIDCScope(granted)
        if (requested.includes(scopes[1]) && !granted.includes(scopes[1])) {
            grant.rejectResourceScope(config.resource, scopes[1])
            grant.rejectOIDCScope(scopes[1])
        }
        if (requested.includes('offline_access')) grant.addOIDCScope('offline_access')
        const grantId = await grant.save()
        const [created] = await db.insert(mcpOAuthGrants).values({
            userId: user.id, grantId, interactionId: uid, clientId,
            clientName: (client.clientName || 'MCP 客户端').slice(0, 120),
            scopes: granted, expiresAt: new Date(Date.now() + grantLifetime * 1000),
        }).onConflictDoNothing({ target: mcpOAuthGrants.interactionId }).returning({ id: mcpOAuthGrants.id })
        if (!created) {
            await revokeGrant(grantId)
            return expired(c)
        }
        c.get('logger')?.info({ userId: user.id, authorizationId: created.id }, 'MCP OAuth authorized')
        return finish({ login: { accountId: user.id, remember: false }, consent: { grantId } })
    })
}

router.get('/mcp-authorizations', cookieAuth(), async (c) => {
    c.header('Cache-Control', 'private, no-store')
    const grants = oauth ? await db.select({
        id: mcpOAuthGrants.id, clientName: mcpOAuthGrants.clientName, scopes: mcpOAuthGrants.scopes,
        expiresAt: mcpOAuthGrants.expiresAt, revokedAt: mcpOAuthGrants.revokedAt,
    }).from(mcpOAuthGrants).where(eq(mcpOAuthGrants.userId, c.get('userId')!))
        .orderBy(desc(mcpOAuthGrants.createdAt)).limit(50) : []
    return c.json({ resource: oauth?.resource ?? null, grants })
})

router.delete('/mcp-authorizations/:id', cookieAuth(), async (c) => {
    if (!oauth) return c.notFound()
    if (c.req.header('X-Hls-Mcp-Management') !== '1'
        || ['cross-site', 'same-site'].includes(c.req.header('Sec-Fetch-Site') ?? '')) return c.body(null, 403)
    const id = z.string().uuid().safeParse(c.req.param('id'))
    if (!id.success) return c.notFound()
    const userId = c.get('userId')!
    const [owned] = await db.select({ grantId: mcpOAuthGrants.grantId }).from(mcpOAuthGrants).where(and(
        eq(mcpOAuthGrants.id, id.data), eq(mcpOAuthGrants.userId, userId),
    )).limit(1)
    if (!owned) return c.notFound()
    await revokeGrant(owned.grantId, userId)
    return c.body(null, 204)
})

export default router
