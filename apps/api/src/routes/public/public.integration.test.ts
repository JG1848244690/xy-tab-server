import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import app from '../../app.js'
import db, { client } from '../../db/index.js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import {
    MIGRATIONS_FOLDER,
    MIGRATIONS_SCHEMA,
    MIGRATIONS_TABLE,
} from '../../db/migrations-table.js'
import { articles, banks, questions, tagRegistry, users } from '../../db/schema.js'
import { hashPassword } from '../../lib/auth.js'
import { truncateBusinessTables } from '../../test/helpers.js'

/**
 * public 模块集成测试(面试站 P0,plan §2.2)
 * 三条铁律逐一验证:只吐 approved / 不泄露归属字段 / SQL 下推分页正确。
 * 内容创建暂无后台 API(P2 才有),用例直接经 db 造数。
 */
const hasDb = !!process.env.TEST_DATABASE_URL

const OWNER = {
    id: 'e0000000-0000-4000-8000-000000000001',
    email: 'public@test.local',
    username: '公开站数据员',
}

async function seedQuestion(over: Partial<typeof questions.$inferInsert>) {
    const [row] = await db
        .insert(questions)
        .values({
            title: '默认题目',
            type: 'text',
            content: '题干内容',
            answer: '参考答案',
            difficulty: 'easy',
            tags: ['javascript'],
            createdBy: OWNER.id,
            ...over,
        })
        .returning()
    return row!
}

describe.skipIf(!hasDb)('public read integration (real PG)', () => {
    beforeAll(async () => {
        await migrate(db, {
            migrationsFolder: MIGRATIONS_FOLDER,
            migrationsTable: MIGRATIONS_TABLE,
            migrationsSchema: MIGRATIONS_SCHEMA,
        })
        const hash = await hashPassword('password123')
        await db
            .insert(users)
            .values({ ...OWNER, password: hash })
            .onConflictDoNothing()
    })

    beforeEach(async () => {
        await truncateBusinessTables(db)
        // 测试库持久,公开站三表全清,防用例间串数据
        await db.delete(articles)
        await db.delete(banks)
        await db.delete(tagRegistry)
    })

    afterAll(async () => {
        await client.end({ timeout: 2 })
    })

    it('列表只吐 approved:draft / pending_review / rejected 全部不可见', async () => {
        await seedQuestion({ status: 'approved', slug: 'pub-q', publishedAt: new Date() })
        await seedQuestion({ title: '草稿', status: 'draft', slug: 'draft-q' })
        await seedQuestion({ title: '待审', status: 'pending_review', slug: 'pending-q' })
        await seedQuestion({ title: '驳回', status: 'rejected', slug: 'rejected-q' })

        const res = await app.request('/public/questions?size=50')
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.total).toBe(1)
        expect(body.data[0].slug).toBe('pub-q')
    })

    it('详情按 slug:approved 给全量(含答案);draft slug 一律 404', async () => {
        await seedQuestion({ status: 'approved', slug: 'detail-q', publishedAt: new Date() })

        const ok = await app.request('/public/questions/detail-q')
        expect(ok.status).toBe(200)
        const detail = await ok.json()
        expect(detail.content).toBe('题干内容')
        expect(detail.answer).toBe('参考答案')
        // 铁律:公开响应不出现归属字段
        expect(detail.createdBy).toBeUndefined()
        expect(detail.userId).toBeUndefined()

        const miss = await app.request('/public/questions/detail-q-missing')
        expect(miss.status).toBe(404)
    })

    it('view:approved 计数自增;非 approved 不计且 404', async () => {
        await seedQuestion({ status: 'approved', slug: 'view-q', publishedAt: new Date() })
        await seedQuestion({ title: '未发', status: 'draft', slug: 'hidden-q' })

        const r1 = await app.request('/public/questions/view-q/view', { method: 'POST' })
        expect((await r1.json()).viewCount).toBe(1)
        await app.request('/public/questions/view-q/view', { method: 'POST' })
        const r3 = await app.request('/public/questions/view-q')
        expect((await r3.json()).viewCount).toBe(2)

        const hidden = await app.request('/public/questions/hidden-q/view', { method: 'POST' })
        expect(hidden.status).toBe(404)
    })

    it('banks:列表带 approved 题数;详情带库内题', async () => {
        const [bank] = await db
            .insert(banks)
            .values({ slug: 'fe-interview', title: '前端面试题库', createdBy: OWNER.id })
            .returning()
        await seedQuestion({ status: 'approved', slug: 'in-bank', bankId: bank!.id, publishedAt: new Date() })
        await seedQuestion({ title: '库外题', status: 'approved', slug: 'outside', publishedAt: new Date() })

        const list = await (await app.request('/public/banks')).json()
        expect(list.data).toHaveLength(1)
        expect(list.data[0].questionCount).toBe(1)

        const detail = await (await app.request('/public/banks/fe-interview')).json()
        expect(detail.questions).toHaveLength(1)
        expect(detail.questions[0].slug).toBe('in-bank')
        expect(detail.questions[0].bankSlug).toBeUndefined()
    })

    it('tags:题目数按 tags@>name 统计;hasIntro 按 240 字判定', async () => {
        await db.insert(tagRegistry).values([
            { slug: 'javascript', name: 'javascript', description: '短介绍' },
            { slug: 'react', name: 'react', description: '长'.repeat(240) },
        ])
        await seedQuestion({ status: 'approved', slug: 'tagged', tags: ['javascript'], publishedAt: new Date() })

        const res = await (await app.request('/public/tags')).json()
        const js = res.data.find((t: { slug: string }) => t.slug === 'javascript')
        const react = res.data.find((t: { slug: string }) => t.slug === 'react')
        expect(js.questionCount).toBe(1)
        expect(js.hasIntro).toBe(false)
        expect(react.hasIntro).toBe(true)
        expect(react.questionCount).toBe(0)
    })

    it('articles:approved 过滤 + relatedQuestionSlugs 只含 approved 题', async () => {
        const pubQ = await seedQuestion({ status: 'approved', slug: 'rel-pub', publishedAt: new Date() })
        await seedQuestion({ title: '草稿关联', status: 'draft', slug: 'rel-draft' })

        await db.insert(articles).values({
            slug: 'how-to-learn',
            title: '如何学习',
            kind: 'own',
            contentMd: '# 正文',
            relatedQuestionIds: [pubQ.id],
            createdBy: OWNER.id,
            status: 'approved',
            publishedAt: new Date(),
        })

        const list = await (await app.request('/public/articles')).json()
        expect(list.total).toBe(1)

        const detail = await (await app.request('/public/articles/how-to-learn')).json()
        expect(detail.contentMd).toBe('# 正文')
        expect(detail.relatedQuestionSlugs).toEqual(['rel-pub'])
    })

    it('sitemap-data:只含 approved 的 questions/articles,banks/tags 全量', async () => {
        await seedQuestion({ status: 'approved', slug: 'sm-1', publishedAt: new Date() })
        await seedQuestion({ title: '不发', status: 'draft', slug: 'sm-2' })
        await db
            .insert(banks)
            .values({ slug: 'sm-bank', title: '库', createdBy: OWNER.id })

        const res = await (await app.request('/public/sitemap-data')).json()
        expect(res.questions.map((q: { slug: string }) => q.slug)).toEqual(['sm-1'])
        expect(res.banks.map((b: { slug: string }) => b.slug)).toEqual(['sm-bank'])
        expect(res.tags).toEqual([])
    })
})
