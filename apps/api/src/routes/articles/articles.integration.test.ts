import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import app from '../../app.js'
import db, { client } from '../../db/index.js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import {
    MIGRATIONS_FOLDER,
    MIGRATIONS_SCHEMA,
    MIGRATIONS_TABLE,
} from '../../db/migrations-table.js'
import { articles, users } from '../../db/schema.js'
import { hashPassword } from '../../lib/auth.js'
import { req } from '../../test/helpers.js'

const hasDb = !!process.env.TEST_DATABASE_URL

const ADMIN = {
    id: 'a9000000-0000-4000-8000-000000000001',
    email: 'article-admin@test.local',
    username: '文章管理员',
}
const USER = {
    id: 'a9000000-0000-4000-8000-000000000002',
    email: 'article-user@test.local',
    username: '普通用户',
}

describe.skipIf(!hasDb)('articles admin integration (real PG)', () => {
    beforeAll(async () => {
        await migrate(db, {
            migrationsFolder: MIGRATIONS_FOLDER,
            migrationsTable: MIGRATIONS_TABLE,
            migrationsSchema: MIGRATIONS_SCHEMA,
        })
        const hash = await hashPassword('password123')
        await db
            .insert(users)
            .values([
                { ...ADMIN, password: hash, role: 'admin' },
                { ...USER, password: hash },
            ])
            .onConflictDoNothing()
    })

    beforeEach(async () => {
        await db.delete(articles)
    })

    afterAll(async () => {
        await client.end({ timeout: 2 })
    })

    const create = (user: typeof ADMIN, body: Record<string, unknown>) =>
        req(app, user, '/articles', { method: 'POST', body: JSON.stringify(body) })

    it('只有 admin 能进文章管理', async () => {
        const res = await req(app, USER, '/articles')
        expect(res.status).toBe(403)
    })

    it('原创:草稿可先不写正文,发布前必须有正文', async () => {
        const draft = await create(ADMIN, {
            kind: 'own',
            title: '草稿文章',
            status: 'draft',
        })
        expect(draft.status).toBe(200)
        const row = await draft.json()
        expect(row.slug).toMatch(/^a-[a-z0-9]+$/)
        expect(row.status).toBe('draft')

        const bad = await req(app, ADMIN, `/articles/${row.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'approved' }),
        })
        expect(bad.status).toBe(400)

        const ok = await req(app, ADMIN, `/articles/${row.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
                contentMd: '## 小节\n\n正文内容足够长,可以发布。',
                status: 'approved',
            }),
        })
        expect(ok.status).toBe(200)
        const published = await ok.json()
        expect(published.status).toBe('approved')
        expect(published.publishedAt).toBeTruthy()
        expect(published.excerpt).toContain('正文内容')
    })

    it('荐文:自动补 sourceDomain,发布必须有外链', async () => {
        const bad = await create(ADMIN, { kind: 'curated', title: '缺链接', status: 'approved' })
        expect(bad.status).toBe(422)

        const res = await create(ADMIN, {
            kind: 'curated',
            title: '一篇好文',
            externalUrl: 'https://example.com/blog/post',
            comment: '值得一读',
            status: 'approved',
        })
        expect(res.status).toBe(200)
        const row = await res.json()
        expect(row.sourceDomain).toBe('example.com')
    })

    it('slug 冲突返回 409,列表可按类型/状态过滤', async () => {
        await create(ADMIN, { kind: 'own', title: 'A', slug: 'fixed-slug' })
        const dup = await create(ADMIN, { kind: 'own', title: 'B', slug: 'fixed-slug' })
        expect(dup.status).toBe(409)

        const list = await req(app, ADMIN, '/articles?kind=own')
        const body = await list.json()
        expect(body.total).toBe(1)
        expect(body.data[0].title).toBe('A')
    })

    it('删除后不再出现', async () => {
        const created = await (await create(ADMIN, { kind: 'own', title: '待删' })).json()
        const del = await req(app, ADMIN, `/articles/${created.id}`, { method: 'DELETE' })
        expect(del.status).toBe(200)
        const list = await req(app, ADMIN, '/articles')
        expect((await list.json()).total).toBe(0)
    })
})
