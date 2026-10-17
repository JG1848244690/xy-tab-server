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
import { todos, users } from '../../db/schema.js'
import { hashPassword } from '../../lib/auth.js'
import { truncateBusinessTables, req } from '../../test/helpers.js'

/**
 * todos 集成测试:归属权(user_id 过滤)+ not-found 语义(B3:400→404)
 */
const hasDb = !!process.env.TEST_DATABASE_URL

const U1 = {
    id: 'c0000000-0000-4000-8000-000000000001',
    email: 'todo1@test.local',
    username: '用户一',
}
const U2 = {
    id: 'd0000000-0000-4000-8000-000000000002',
    email: 'todo2@test.local',
    username: '用户二',
}

describe.skipIf(!hasDb)('todos integration (real PG)', () => {
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
                { ...U1, password: hash },
                { ...U2, password: hash },
            ])
            .onConflictDoNothing()
    })

    beforeEach(async () => {
        await truncateBusinessTables(db)
    })

    afterAll(async () => {
        await client.end({ timeout: 2 })
    })

    const NO_ID = '00000000-0000-4000-8000-0000000000ff'

    it('create → toggle → toggle:打卡状态来回切换,只动自己的行', async () => {
        const created = await req(app, U1, '/todos', {
            method: 'POST',
            body: JSON.stringify({
                content: '背单词',
                startDate: '2026-10-16',
                endDate: '2026-10-16',
            }),
        })
        expect(created.status).toBe(200)
        const todo = await created.json()

        const t1 = await req(app, U1, `/todos/${todo.id}/toggle`, { method: 'PATCH' })
        expect(t1.status).toBe(200)
        expect(await t1.json()).toMatchObject({ id: todo.id, completed: true })

        const t2 = await req(app, U1, `/todos/${todo.id}/toggle`, { method: 'PATCH' })
        expect((await t2.json()).completed).toBe(false)
    })

    it('不存在的 id:update / remove / toggle 一律 404(以前是 400,B3)', async () => {
        for (const [method, path] of [
            ['PATCH', `/todos/${NO_ID}`],
            ['DELETE', `/todos/${NO_ID}`],
            ['PATCH', `/todos/${NO_ID}/toggle`],
        ] as const) {
            const res = await req(app, U1, path, {
                method,
                body: method === 'PATCH' && !path.includes('toggle')
                    ? JSON.stringify({ content: '改内容' })
                    : undefined,
            })
            expect(res.status).toBe(404)
            expect(await res.json()).toMatchObject({ message: 'Todo not found', code: 'NOT_FOUND' })
        }
    })

    it('归属权:U2 动不了 U1 的 todo', async () => {
        const created = await req(app, U1, '/todos', {
            method: 'POST',
            body: JSON.stringify({
                content: 'U1 的日程',
                startDate: '2026-10-16',
                endDate: '2026-10-16',
            }),
        })
        const { id } = await created.json()

        const removed = await req(app, U2, `/todos/${id}`, { method: 'DELETE' })
        expect(removed.status).toBe(404)

        // U2 造一条同名,确认 U1 的行没被动
        await req(app, U2, '/todos', {
            method: 'POST',
            body: JSON.stringify({
                content: 'U2 的日程',
                startDate: '2026-10-16',
                endDate: '2026-10-16',
            }),
        })
        const rows = await db.select().from(todos).where(eq(todos.userId, U1.id))
        expect(rows).toHaveLength(1)
    })

    it('by-date / by-month:跨天事件覆盖与月份交集', async () => {
        await req(app, U1, '/todos', {
            method: 'POST',
            body: JSON.stringify({
                content: '跨天事件',
                startDate: '2026-10-15',
                endDate: '2026-10-17',
            }),
        })

        // 16 号落在区间内 → 命中
        const byDate = await (await req(app, U1, '/todos/by-date?date=2026-10-16')).json()
        expect(byDate).toHaveLength(1)
        // 18 号不在 → 空
        const miss = await (await req(app, U1, '/todos/by-date?date=2026-10-18')).json()
        expect(miss).toHaveLength(0)
        // 月交集查询能看到
        const byMonth = await (await req(app, U1, '/todos/by-month?year=2026&month=10')).json()
        expect(byMonth).toHaveLength(1)
    })
})
