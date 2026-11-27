import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import type { AddressInfo } from 'node:net'
import { serve } from '@hono/node-server'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

describe.skipIf(!process.env.TEST_DATABASE_URL)('MCP OAuth with PostgreSQL and HTTP', () => {
    let base: string
    let server: ReturnType<typeof serve> | undefined
    let database: typeof import('../../../db/index.js') | undefined
    let session: string
    const user = { id: randomUUID(), email: `oauth-${randomUUID()}@test.local`, username: 'OAuth test', password: 'unused' }
    const callback = 'http://127.0.0.1:49213/callback'

    beforeAll(async () => {
        const socket = createServer()
        await new Promise<void>((resolve) => socket.listen(0, '127.0.0.1', resolve))
        const port = (socket.address() as AddressInfo).port
        await new Promise<void>((resolve) => socket.close(() => resolve()))
        base = `http://127.0.0.1:${port}`
        process.env.MCP_OAUTH_ISSUER = base
        process.env.MCP_OAUTH_RESOURCE_PATH = '/api-hls/mcp'
        database = await import('../../../db/index.js')
        const { users } = await import('../../../db/schema.js')
        const { MIGRATIONS_FOLDER, MIGRATIONS_SCHEMA, MIGRATIONS_TABLE } = await import('../../../db/migrations-table.js')
        await migrate(database.default, {
            migrationsFolder: MIGRATIONS_FOLDER,
            migrationsTable: MIGRATIONS_TABLE,
            migrationsSchema: MIGRATIONS_SCHEMA,
        })
        await database.default.insert(users).values(user)
        const { signToken } = await import('../../../lib/auth.js')
        const { default: env } = await import('../../../env.js')
        session = `${env.AUTH_COOKIE_NAME}=${await signToken(user.id, user.email)}`
        const { default: app } = await import('../../../app.js')
        await new Promise<void>((resolve) => {
            server = serve({ hostname: '127.0.0.1', port, overrideGlobalObjects: false, fetch(request, bindings) {
                const url = new URL(request.url)
                if (url.pathname.startsWith('/api-hls/')) {
                    url.pathname = url.pathname.slice('/api-hls'.length)
                    return app.fetch(new Request(url, request), bindings)
                }
                return app.fetch(request, bindings)
            } }, () => resolve())
        })
    })

    afterAll(async () => {
        if (server) await new Promise<void>((resolve) => server!.close(() => resolve()))
        if (database) {
            const { users } = await import('../../../db/schema.js')
            await database.default.delete(users).where(eq(users.id, user.id))
            await database.client.end()
        }
    })

    const url = (path: string) => base + path
    const postJson = (path: string, body: object) => fetch(url(path), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const call = (authorization: string, method: string, params?: object) => fetch(url('/api-hls/mcp'), {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + authorization, 'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })

    it('discovers authorization, registers loopback clients, exchanges PKCE and enforces scope, refresh and revocation', async () => {
        const challenge = await fetch(url('/api-hls/mcp'))
        expect(challenge.status).toBe(401)
        expect(challenge.headers.get('www-authenticate')).toContain(url('/.well-known/oauth-protected-resource/api-hls/mcp'))
        const protectedResource = await (await fetch(url('/.well-known/oauth-protected-resource/api-hls/mcp'))).json()
        expect(protectedResource.resource).toBe(url('/api-hls/mcp'))
        const discovery = await (await fetch(url('/.well-known/oauth-authorization-server'))).json()
        expect(discovery).toMatchObject({ issuer: base, authorization_endpoint: url('/api-hls/oauth/authorize'),
            token_endpoint: url('/api-hls/oauth/token'), registration_endpoint: url('/api-hls/oauth/register'),
            code_challenge_methods_supported: ['S256'] })

        const registration = { client_name: 'MCP Integration', redirect_uris: [callback],
            grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none',
            scope: 'todos:read todos:write offline_access' }
        const blockedRegistration = await postJson('/api-hls/oauth/register', { ...registration, redirect_uris: ['https://example.invalid/callback'] })
        expect(blockedRegistration.status).toBe(400)
        expect(await blockedRegistration.json()).toMatchObject({ error: 'invalid_client_metadata' })
        const registered = await postJson('/api-hls/oauth/register', registration)
        const registrationResponse = await registered.json()
        expect(registered.status, JSON.stringify(registrationResponse)).toBe(201)
        const { client_id } = registrationResponse
        const verifier = randomBytes(32).toString('base64url')
        const params = {
            client_id, redirect_uri: callback, response_type: 'code', state: randomUUID(),
            resource: url('/api-hls/mcp'), code_challenge_method: 'S256',
            code_challenge: createHash('sha256').update(verifier).digest('base64url'),
            scope: 'todos:read todos:write offline_access',
        }
        const authorize = (overrides: object = {}) => url('/api-hls/oauth/authorize?') + new URLSearchParams({ ...params, ...overrides })
        const wrongTarget = await fetch(authorize({ resource: url('/other') }), { redirect: 'manual' })
        const invalidTarget = wrongTarget.headers.get('location') ?? await wrongTarget.text()
        expect(invalidTarget).toContain('invalid_target')

        const cookies = new Map<string, string>()
        async function browser(path: string, init: RequestInit = {}) {
            const response = await fetch(new URL(path, base), { ...init, redirect: 'manual', headers: {
                Cookie: [...cookies.values()].join('; '), ...init.headers,
            } })
            for (const value of response.headers.getSetCookie()) {
                const item = value.split(';')[0]!
                const name = item.split('=')[0]!
                if (item === name + '=' || /Max-Age=0\b/i.test(value)) cookies.delete(name)
                else cookies.set(name, item)
            }
            return response
        }
        const first = await browser(authorize())
        expect(first.status).toBe(303)
        const interaction = first.headers.get('location')!
        expect(interaction).toContain('/api-hls/oauth/interaction/')
        const login = await browser(interaction)
        expect(login.headers.get('location')).toContain('/login?mcp_oauth=')
        cookies.set('hlsedu-session', session)
        const consent = await browser(interaction)
        expect(consent.status).toBe(200)
        const csrf = (await consent.text()).match(/name="csrf" value="([^"]+)"/)?.[1]
        expect(csrf).toBeTruthy()

        const crossOrigin = await browser(interaction, {
            method: 'POST', headers: { Origin: 'https://example.invalid' }, body: new URLSearchParams({ decision: 'allow', csrf: csrf! }),
        })
        expect(crossOrigin.status).toBe(403)
        const confirm = await browser(interaction, {
            method: 'POST', headers: { Origin: base }, body: new URLSearchParams({ decision: 'allow', csrf: csrf! }),
        })
        expect(confirm.status).toBe(303)
        const resumed = await browser(confirm.headers.get('location')!)
        const redirect = new URL(resumed.headers.get('location')!)
        expect(redirect.origin + redirect.pathname).toBe(callback)
        expect(redirect.searchParams.get('state')).toBe(params.state)
        expect(redirect.searchParams.get('iss')).toBe(base)
        const code = redirect.searchParams.get('code')
        expect(code).toBeTruthy()

        const token = (grant: object) => fetch(url('/api-hls/oauth/token'), {
            method: 'POST', body: new URLSearchParams({ client_id, resource: params.resource, ...grant }),
        })
        const exchanged = await token({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: callback })
        expect(exchanged.status).toBe(200)
        const initial = await exchanged.json()
        expect(initial.scope?.split(' ')).toContain('todos:read')
        expect(initial.scope?.split(' ')).not.toContain('todos:write')
        const discovered = await (await call(initial.access_token, 'tools/list')).json()
        expect(discovered.result.tools.map((tool: { name: string }) => tool.name)).toEqual(['list_todos'])
        const forbidden = await call(initial.access_token, 'tools/call', { name: 'create_todo', arguments: { content: 'read-only' } })
        expect(forbidden.status).toBe(403)
        expect(forbidden.headers.get('www-authenticate')).toContain('scope="todos:write"')

        const rotated = await token({ grant_type: 'refresh_token', refresh_token: initial.refresh_token })
        expect(rotated.status).toBe(200)
        const latest = await rotated.json()
        expect(latest.refresh_token).not.toBe(initial.refresh_token)
        const { grants } = await (await fetch(url('/api-hls/mcp-authorizations'), { headers: { Cookie: session } })).json()
        expect(grants).toHaveLength(1)
        expect((await fetch(url('/api-hls/mcp-authorizations/' + grants[0].id), {
            method: 'DELETE', headers: { Cookie: session, 'X-Hls-Mcp-Management': '1' },
        })).status).toBe(204)
        expect((await call(latest.access_token, 'tools/list')).status).toBe(401)
        expect((await token({ grant_type: 'refresh_token', refresh_token: latest.refresh_token })).status).toBe(400)

        const legacy = await fetch(url('/api-hls/mcp-keys'), {
            method: 'POST',
            headers: { Cookie: session, 'Content-Type': 'application/json', 'X-Hls-Mcp-Management': '1' },
            body: JSON.stringify({ name: 'Legacy while OAuth is enabled', access: 'read', expiresInDays: 7 }),
        })
        expect(legacy.status).toBe(201)
        expect((await call((await legacy.json()).token, 'tools/list')).status).toBe(200)
    })
})
