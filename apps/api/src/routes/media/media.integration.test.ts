import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import app from '../../app.js'
import db, { client } from '../../db/index.js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import {
    MIGRATIONS_FOLDER,
    MIGRATIONS_SCHEMA,
    MIGRATIONS_TABLE,
} from '../../db/migrations-table.js'
import { mediaAssets, questions, users } from '../../db/schema.js'
import { hashPassword, signToken } from '../../lib/auth.js'
import env from '../../env.js'
import { truncateBusinessTables } from '../../test/helpers.js'

/**
 * 图片统一管理集成测试(2026-10-26)
 *
 * 覆盖:上传(魔数/大小/落盘)、列表统计、引用保护、清理孤儿、本地静态托管。
 */
const hasDb = !!process.env.TEST_DATABASE_URL

const ADMIN = {
    id: 'd1000000-0000-4000-8000-000000000001',
    email: 'media-admin@test.local',
}
const USER = {
    id: 'd1000000-0000-4000-8000-000000000002',
    email: 'media-user@test.local',
}

/** 最小合法 1x1 PNG */
const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
    'base64',
)

const uploadRoot = join(tmpdir(), `hls-media-test-${process.pid}`)

describe.skipIf(!hasDb)('media assets integration (real PG)', () => {
    beforeAll(async () => {
        // 上传根目录指到临时目录;config.ts 是运行时读 env,先设后跑
        process.env.UPLOAD_DIR = uploadRoot
        process.env.UPLOAD_PUBLIC_BASE = 'https://cdn.test/uploads'

        await migrate(db, {
            migrationsFolder: MIGRATIONS_FOLDER,
            migrationsTable: MIGRATIONS_TABLE,
            migrationsSchema: MIGRATIONS_SCHEMA,
        })
        const hash = await hashPassword('password123')
        await db
            .insert(users)
            .values([
                { ...ADMIN, password: hash, role: 'admin' as const },
                { ...USER, password: hash, role: 'user' as const },
            ])
            .onConflictDoNothing()
    })

    beforeEach(async () => {
        await truncateBusinessTables(db)
        await db.delete(mediaAssets)
    })

    afterAll(async () => {
        await rm(uploadRoot, { recursive: true, force: true })
        await client.end({ timeout: 2 })
    })

    async function authFetch(
        user: { id: string; email: string },
        path: string,
        init: RequestInit = {},
    ) {
        const token = await signToken(user.id, user.email)
        return app.request(path, {
            ...init,
            headers: {
                Cookie: `${env.AUTH_COOKIE_NAME}=${token}`,
                ...(init.headers ?? {}),
            },
        })
    }

    function imageForm(buf: Buffer, name = 'x.png') {
        const fd = new FormData()
        fd.append('file', new File([buf], name, { type: 'image/png' }))
        return fd
    }

    it('上传 png:落盘 + 入库 + 返回 static 子域 URL', async () => {
        const res = await authFetch(USER, '/media/upload', {
            method: 'POST',
            body: imageForm(PNG),
        })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.asset.url).toMatch(/^https:\/\/cdn\.test\/uploads\/\d{4}\/\d{2}\/.+\.png$/)
        expect(body.asset.mime).toBe('image/png')
        expect(body.asset.bytes).toBe(PNG.length)

        // 文件真的写到了 UPLOAD_DIR
        const rel = body.asset.url.replace('https://cdn.test/uploads/', '')
        const stored = await readFile(join(uploadRoot, rel))
        expect(stored.equals(PNG)).toBe(true)
    })

    it('伪装成 png 的文本 → 415(靠魔数,不信 content-type)', async () => {
        const res = await authFetch(USER, '/media/upload', {
            method: 'POST',
            body: imageForm(Buffer.from('not an image'), 'fake.png'),
        })
        expect(res.status).toBe(415)
    })

    it('超过 5MB → 413', async () => {
        const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)])
        const res = await authFetch(USER, '/media/upload', {
            method: 'POST',
            body: imageForm(big, 'big.png'),
        })
        expect(res.status).toBe(413)
    })

    it('列表:非 admin 403;admin 看到 counts + 引用次数', async () => {
        const uploadRes = await authFetch(USER, '/media/upload', {
            method: 'POST',
            body: imageForm(PNG),
        })
        const { asset } = await uploadRes.json()

        const forbidden = await authFetch(USER, '/media')
        expect(forbidden.status).toBe(403)

        // 放进一道题的正文 → usage 变 1
        await db.insert(questions).values({
            title: '引用图片的题',
            type: 'markdown',
            content: `看图作答\n\n![示意图](${asset.url})`,
            answer: '答案',
            difficulty: 'easy',
            createdBy: USER.id,
            status: 'approved',
            slug: 'media-usage-q',
        })

        const res = await authFetch(ADMIN, '/media')
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.total).toBe(1)
        expect(body.data[0].usage).toBe(1)
        expect(body.counts).toEqual({ all: 1, unused: 0 })

        // 未使用筛选应为空
        const unused = await (await authFetch(ADMIN, '/media?unused=1')).json()
        expect(unused.total).toBe(0)
    })

    it('被引用的图不能删(409);解除引用后可删,文件同步删除', async () => {
        const { asset } = await (
            await authFetch(USER, '/media/upload', { method: 'POST', body: imageForm(PNG) })
        ).json()
        const [q] = await db
            .insert(questions)
            .values({
                title: '引用图片的题',
                type: 'markdown',
                content: `![图](${asset.url})`,
                answer: '答案',
                difficulty: 'easy',
                createdBy: USER.id,
                status: 'approved',
                slug: 'media-del-q',
            })
            .returning()

        const blocked = await authFetch(ADMIN, `/media/${asset.id}`, { method: 'DELETE' })
        expect(blocked.status).toBe(409)

        // 解除引用 → 可删
        await db.update(questions).set({ content: '没有图了' }).where(eq(questions.id, q.id))
        const ok = await authFetch(ADMIN, `/media/${asset.id}`, { method: 'DELETE' })
        expect(ok.status).toBe(200)
        await expect(readFile(join(uploadRoot, asset.path))).rejects.toThrow()
        expect(await db.select().from(mediaAssets)).toHaveLength(0)
    })

    it('cleanup:只清未使用,保留被引用的图', async () => {
        const used = await (
            await authFetch(USER, '/media/upload', { method: 'POST', body: imageForm(PNG) })
        ).json()
        const orphan = await (
            await authFetch(USER, '/media/upload', { method: 'POST', body: imageForm(PNG) })
        ).json()
        await db.insert(questions).values({
            title: '用了图',
            type: 'markdown',
            content: `![图](${used.asset.url})`,
            answer: '答案',
            difficulty: 'easy',
            createdBy: USER.id,
            status: 'approved',
            slug: 'media-clean-q',
        })

        const res = await authFetch(ADMIN, '/media/cleanup', { method: 'POST' })
        expect(res.status).toBe(200)
        expect((await res.json()).deleted).toBe(1)

        const left = await db.select().from(mediaAssets)
        expect(left.map((r) => r.id)).toEqual([used.asset.id])
        await expect(readFile(join(uploadRoot, orphan.asset.path))).rejects.toThrow()
    })

    it('本地静态托管:/uploads/<path> 能直接取到文件', async () => {
        const { asset } = await (
            await authFetch(USER, '/media/upload', { method: 'POST', body: imageForm(PNG) })
        ).json()
        const res = await app.request(`/uploads/${asset.path}`)
        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toBe('image/png')
        expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true)
    })
})
