import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq, inArray } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import type { AppOpenAPI } from '../../lib/types.js'

const users = [
    { id: randomUUID(), username: 'omen', role: 'admin' as const },
    { id: randomUUID(), username: 'another admin', role: 'admin' as const },
].map((user) => ({ ...user, email: `libraries-${user.id}@test.local`, password: 'unused' }))
const [owner, other] = users as [typeof users[number], typeof users[number]]

describe.skipIf(!process.env.TEST_DATABASE_URL)('owner-only file libraries', () => {
    let app: AppOpenAPI
    let req: typeof import('../../test/helpers.js').req
    let db: typeof import('../../db/index.js') | undefined
    let temp: string | undefined
    let publicRoot: string
    let archiveRoot: string
    const publicHeader = { 'X-Hls-File-Library': '1' }

    beforeAll(async () => {
        temp = await mkdtemp(join(tmpdir(), 'hlse-library-test-'))
        publicRoot = join(temp, 'static')
        archiveRoot = join(temp, 'archive')
        const outsider = join(temp, 'outside')
        const assets = join(publicRoot, 'assets')
        await Promise.all([mkdir(assets, { recursive: true }), mkdir(archiveRoot), mkdir(outsider)])
        await Promise.all([
            writeFile(join(archiveRoot, '旧手机.mp4'), '0123456789abcdef'),
            writeFile(join(archiveRoot, '.secret.jpg'), 'fixture'),
            writeFile(join(outsider, 'outside.png'), 'fixture'),
            writeFile(join(publicRoot, 'manual.pdf'), 'fixture'),
        ])
        await symlink(outsider, join(archiveRoot, 'external'), process.platform === 'win32' ? 'junction' : 'dir')
        process.env.FILE_LIBRARY_OWNER_ID = owner.id
        process.env.STATIC_LIBRARY_ROOT = publicRoot
        process.env.STATIC_LIBRARY_UPLOAD_ROOT = assets
        process.env.PRIVATE_GALLERY_ROOT = archiveRoot
        db = await import('../../db/index.js')
        const schema = await import('../../db/schema.js')
        const { MIGRATIONS_FOLDER, MIGRATIONS_SCHEMA, MIGRATIONS_TABLE } = await import('../../db/migrations-table.js')
        await migrate(db.default, {
            migrationsFolder: MIGRATIONS_FOLDER, migrationsSchema: MIGRATIONS_SCHEMA, migrationsTable: MIGRATIONS_TABLE,
        })
        await db.default.insert(schema.users).values(users)
        app = (await import('../../app.js')).default
        req = (await import('../../test/helpers.js')).req
    })

    afterAll(async () => {
        if (db) {
            const schema = await import('../../db/schema.js')
            await db.default.delete(schema.users).where(inArray(schema.users.id, users.map((user) => user.id)))
            await db.client.end()
        }
        if (temp) await rm(temp, { recursive: true, force: true })
    })

    it('checks the account before every listing, preview and range download', async () => {
        expect((await (await req(app, owner, '/auth/me')).json()).fileLibraries).toBe(true)
        expect((await (await req(app, other, '/auth/me')).json()).fileLibraries).toBe(false)
        const listPath = '/file-library/private/list'
        const filePath = '/file-library/private/file?path=' + encodeURIComponent('旧手机.mp4')
        expect((await app.request(listPath)).status).toBe(401)
        expect((await app.request(filePath)).status).toBe(401)
        expect((await req(app, other, '/file-library/static/list')).status).toBe(404)
        expect((await req(app, other, filePath, { headers: { Range: 'bytes=2-6' } })).status).toBe(404)
        const listing = await req(app, owner, listPath)
        expect(listing.headers.get('cache-control')).toContain('no-store')
        expect(await listing.json()).toMatchObject({ total: 1, items: [{ path: '旧手机.mp4', mime: 'video/mp4' }] })
        const ranged = await req(app, owner, filePath + '&preview=1', { headers: { Range: 'bytes=2-6' } })
        expect(ranged.status).toBe(206)
        expect(ranged.headers.get('content-range')).toBe('bytes 2-6/16')
        expect(ranged.headers.get('cross-origin-resource-policy')).toBe('same-origin')
        expect(await ranged.text()).toBe('23456')
        const attachment = await req(app, owner, filePath)
        expect(attachment.headers.get('content-disposition')).toMatch(/^attachment;/)
        await attachment.arrayBuffer()
        expect((await req(app, owner, filePath, { headers: { Range: 'bytes=16-17' } })).status).toBe(416)
        expect((await req(app, owner, '/file-library/private/file?path=../static/manual.pdf')).status).toBe(400)
        expect((await req(app, owner, '/file-library/private/file?path=external/outside.png')).status).toBe(404)
        expect((await req(app, owner, '/file-library/private/upload', { method: 'POST', headers: publicHeader })).status).toBe(404)
        const { users: userTable } = await import('../../db/schema.js')
        await db!.default.update(userTable).set({ role: 'user' }).where(eq(userTable.id, owner.id))
        try { expect((await req(app, owner, filePath)).status).toBe(404) }
        finally {
            await db!.default.update(userTable).set({ role: 'admin' }).where(eq(userTable.id, owner.id))
        }
    })

    it('publishes validated uploads under assets without overwriting or writing into existing directories', async () => {
        const create = (path: string, user = owner) => req(app, user, '/file-library/static/folder', {
            method: 'POST', headers: publicHeader, body: JSON.stringify({ path, name: 'fixture' }),
        })
        const image = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1]).buffer
        const upload = (name: string, body: string | ArrayBuffer, top = 'assets/fixture') =>
            req(app, owner, '/file-library/static/upload?' + new URLSearchParams({ path: top, name }), {
                method: 'POST', headers: publicHeader, body,
            })
        expect((await create('assets', other)).status).toBe(404)
        expect((await create('')).status).toBe(403)
        expect((await create('assets')).status).toBe(201)
        expect((await upload('fake.png', '<html>')).status).toBe(415)
        expect((await upload('unsafe.html', '<html>')).status).toBe(415)
        expect((await upload('cover.png', image, '')).status).toBe(403)
        expect((await upload('cover.png', image)).status).toBe(201)
        expect((await upload('cover.png', image)).status).toBe(409)
        expect(await readFile(join(publicRoot, 'assets', 'fixture', 'cover.png'))).toEqual(Buffer.from(image))
        const listed = await (await req(app, owner, '/file-library/static/list?path=assets/fixture')).json()
        expect(listed).toMatchObject({ total: 1, items: [{ name: 'cover.png' }] })
    })
})
