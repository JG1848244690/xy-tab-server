import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import app from '../../app.js'
import db, { client } from '../../db/index.js'
import { MIGRATIONS_FOLDER, MIGRATIONS_SCHEMA, MIGRATIONS_TABLE } from '../../db/migrations-table.js'
import { mcpKeys, users } from '../../db/schema.js'
import { learningDate } from '../../lib/learning-days.js'
import { req } from '../../test/helpers.js'

const first = { id: randomUUID(), email: `mcp-${randomUUID()}@test.local`, username: 'MCP one' }
const second = { id: randomUUID(), email: `mcp-${randomUUID()}@test.local`, username: 'MCP two' }
const headers = { 'X-Hls-Mcp-Management': '1' }

function mcp(method: string, params?: object, token?: string, origin?: string) {
    return app.request('/mcp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'MCP-Protocol-Version': '2025-06-18',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(origin ? { Origin: origin } : {}),
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
}

async function tool(token: string, name: string, args: object) {
    return (await mcp('tools/call', { name, arguments: args }, token)).json()
}

async function issueKey(user: typeof first, access: 'read' | 'read_write') {
    const response = await req(app, user, '/mcp-keys', {
        method: 'POST', headers,
        body: JSON.stringify({ name: 'OpenCode', access, expiresInDays: 30 }),
    })
    expect(response.status).toBe(201)
    expect(response.headers.get('cache-control')).toContain('no-store')
    return response.json() as Promise<{ id: string; token: string }>
}

describe.skipIf(!process.env.TEST_DATABASE_URL)('MCP with real PostgreSQL', () => {
    beforeAll(async () => {
        await migrate(db, {
            migrationsFolder: MIGRATIONS_FOLDER,
            migrationsTable: MIGRATIONS_TABLE,
            migrationsSchema: MIGRATIONS_SCHEMA,
        })
        await db.insert(users).values([first, second].map((user) => ({ ...user, password: 'unused' })))
    })

    afterAll(async () => {
        await Promise.all([first, second].map((user) => db.delete(users).where(eq(users.id, user.id))))
        await client.end({ timeout: 2 })
    })

    it('issues credentials through the SPA session, isolates management, and rejects expired or revoked keys', async () => {
        expect((await app.request('/mcp-keys')).status).toBe(401)
        expect((await mcp('tools/list')).status).toBe(401)
        expect((await req(app, first, '/mcp-keys', { method: 'POST' })).status).toBe(403)
        const own = await issueKey(first, 'read')
        expect((await mcp('tools/list', undefined, own.token, 'https://different.example')).status).toBe(403)
        const [stored] = await db.select().from(mcpKeys).where(eq(mcpKeys.id, own.id))
        expect(stored?.tokenHash).toMatch(/^[a-f0-9]{64}$/)
        const listed = await (await req(app, first, '/mcp-keys')).json()
        expect(listed).toContainEqual(expect.objectContaining({ id: own.id }))
        expect(JSON.stringify(listed)).not.toContain(own.token)
        expect(JSON.stringify(listed)).not.toContain(stored?.tokenHash)
        expect(await (await req(app, second, '/mcp-keys')).json()).toEqual([])
        expect((await req(app, second, `/mcp-keys/${own.id}`, { method: 'DELETE', headers })).status).toBe(404)
        expect((await mcp('tools/list', undefined, own.token)).status).toBe(200)
        await db.update(mcpKeys).set({ expiresAt: new Date(0) }).where(eq(mcpKeys.id, own.id))
        expect((await mcp('tools/list', undefined, own.token)).status).toBe(401)

        const active = await issueKey(first, 'read')
        expect((await req(app, first, `/mcp-keys/${active.id}`, { method: 'DELETE', headers })).status).toBe(204)
        expect((await mcp('tools/list', undefined, active.token)).status).toBe(401)
    })

    it('supports discovery, idempotent creation, owner-scoped queries and completion', async () => {
        const writer = await issueKey(first, 'read_write')
        const reader = await issueKey(first, 'read')
        const other = await issueKey(second, 'read_write')
        const init = await mcp('initialize', {
            protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' },
        }, writer.token)
        expect((await init.json()).result.serverInfo.name).toBe('hlsedu')
        const discovered = await (await mcp('tools/list', undefined, reader.token)).json()
        expect(discovered.result.tools.map((entry: { name: string }) => entry.name)).toEqual(['list_todos'])
        const denied = await tool(reader.token, 'create_todo', { content: '不可创建' })
        expect(Boolean(denied.error || denied.result?.isError)).toBe(true)

        const input = { content: '交周报', requestId: randomUUID() }
        const [a, b] = await Promise.all([tool(writer.token, 'create_todo', input), tool(writer.token, 'create_todo', input)])
        const created = a.result.structuredContent
        expect(created).toMatchObject({ content: input.content, startDate: learningDate(), completed: false })
        expect(b.result.structuredContent).toEqual(created)
        expect((await tool(writer.token, 'create_todo', { ...input, content: '另一事项' })).result.isError).toBe(true)
        const page = await tool(reader.token, 'list_todos', { query: '周报' })
        expect(page.result.structuredContent.items).toEqual([created])
        expect((await tool(other.token, 'list_todos', {})).result.structuredContent.items).toEqual([])
        expect((await tool(other.token, 'complete_todo', { id: created.id })).result.isError).toBe(true)

        const rest = await req(app, first, `/todos/by-date?date=${created.startDate}`)
        expect(await rest.json()).toContainEqual(expect.objectContaining({ id: created.id }))
        for (let attempt = 0; attempt < 2; attempt++) {
            const completed = await tool(writer.token, 'complete_todo', { id: created.id })
            expect(completed.result.structuredContent).toEqual({ id: created.id, completed: true })
        }
    })
})
