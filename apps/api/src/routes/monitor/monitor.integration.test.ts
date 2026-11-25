import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import app from '../../app.js'
import db, { client } from '../../db/index.js'
import { MIGRATIONS_FOLDER, MIGRATIONS_SCHEMA, MIGRATIONS_TABLE } from '../../db/migrations-table.js'
import { systemEvents, users } from '../../db/schema.js'
import { hashPassword } from '../../lib/auth.js'
import { req } from '../../test/helpers.js'

const ADMIN = { id: randomUUID(), email: `monitor-admin-${randomUUID()}@example.test` }
const MEMBER = { id: randomUUID(), email: `member-${randomUUID()}@example.test` }
const PASSWORD = 'monitor-fixture-password'

describe.skipIf(!process.env.TEST_DATABASE_URL)('system monitor integration', () => {
    beforeAll(async () => {
        await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER, migrationsTable: MIGRATIONS_TABLE, migrationsSchema: MIGRATIONS_SCHEMA })
        const password = await hashPassword(PASSWORD)
        await db.insert(users).values([
            { ...ADMIN, username: 'ops-monitor-fixture', password, role: 'admin' },
            { ...MEMBER, username: 'member-monitor-fixture', password },
        ])
    })

    afterAll(async () => {
        await db.delete(systemEvents).where(inArray(systemEvents.actorId, [ADMIN.id, MEMBER.id]))
        await db.delete(users).where(inArray(users.id, [ADMIN.id, MEMBER.id]))
        await client.end({ timeout: 2 })
    })

    it('requires a current administrator role, masks identities and records monitored actions', async () => {
        const root = '/admin/monitor'
        expect((await app.request(`${root}/summary`)).status).toBe(401)
        for (const path of ['summary', 'events', 'users', `users/${MEMBER.id}`]) {
            expect((await req(app, MEMBER, `${root}/${path}`)).status).toBe(403)
        }
        const login = await req(app, MEMBER, '/auth/login', {
            method: 'POST', body: JSON.stringify({ email: MEMBER.email, password: PASSWORD }),
        })
        expect(login.status).toBe(200)
        expect(login.headers.get('x-request-id')).toMatch(/^[a-f0-9-]{36}$/)

        const list = await req(app, ADMIN, `${root}/users?filter=unverified&q=member-monitor-fixture`)
        expect(list.status).toBe(200)
        expect(list.headers.get('cache-control')).toBe('private, no-store')
        const payload = await list.text()
        expect(payload).not.toContain(MEMBER.email)
        expect(payload).not.toContain('createdIpHash')
        expect(JSON.parse(payload)).toMatchObject({ data: [{
            id: MEMBER.id, email: 'm***@e***.test', lastLogin: expect.any(String),
        }] })

        const detail = await req(app, ADMIN, `${root}/users/${MEMBER.id}`)
        expect(await detail.json()).toMatchObject({ activity: expect.arrayContaining([
            expect.objectContaining({ action: 'login', status: 200 }),
        ]) })
        const audited = await req(app, ADMIN, `${root}/events?action=admin_user_viewed`)
        expect(await audited.json()).toMatchObject({ data: expect.arrayContaining([
            expect.objectContaining({ actorId: ADMIN.id, targetId: MEMBER.id, requestId: detail.headers.get('x-request-id') }),
        ]) })
        const summary = await req(app, ADMIN, `${root}/summary`)
        expect(summary.status).toBe(200)
        expect(await summary.json()).toMatchObject({ databaseBytes: expect.any(Number), host: { state: 'unconfigured', snapshot: null } })

        await db.update(users).set({ role: 'user' }).where(eq(users.id, ADMIN.id))
        expect((await req(app, ADMIN, `${root}/summary`)).status).toBe(403)
    })
})
