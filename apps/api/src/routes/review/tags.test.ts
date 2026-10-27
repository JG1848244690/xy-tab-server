import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import db, { client } from '../../db/index.js'
import {
    MIGRATIONS_FOLDER,
    MIGRATIONS_SCHEMA,
    MIGRATIONS_TABLE,
} from '../../db/migrations-table.js'
import { questions, tagRegistry, users } from '../../db/schema.js'
import { truncateBusinessTables } from '../../test/helpers.js'
import { existingTags, normalizeTags } from './tags.js'

/**
 * 标签收敛规则(2026-10-27)
 *
 * 目标:AI 输出优先落回平台已有标签,整题最多新增 1 个;
 * 泛词直接丢弃;大小写/别名不同的写法归一到已有写法。
 */

describe('normalizeTags', () => {
    it('别名归一 + 忽略大小写去重', () => {
        expect(normalizeTags(['js', 'JavaScript', 'vue3'])).toEqual(['JavaScript', 'Vue'])
    })

    it('命中已有标签时强制用平台写法', () => {
        expect(
            normalizeTags(['javascript', 'react'], {
                vocabulary: ['JavaScript', 'React', 'Vue'],
            }),
        ).toEqual(['JavaScript', 'React'])
    })

    it('不在词表里的标签最多保留 maxNew 个', () => {
        expect(
            normalizeTags(['Vue', 'WebSocket', '虚拟列表', 'React'], {
                vocabulary: ['Vue', 'React'],
                maxNew: 1,
            }),
        ).toEqual(['Vue', 'WebSocket', 'React'])
    })

    it('词表完全没覆盖时不过度裁剪(否则新领域题目只剩 1 个标签)', () => {
        expect(
            normalizeTags(['WebSocket', '实时通信', '长连接'], {
                vocabulary: ['Vue', 'React'],
                maxNew: 1,
            }),
        ).toEqual(['WebSocket', '实时通信', '长连接'])
    })

    it('泛词直接丢弃', () => {
        expect(normalizeTags(['面试题', '场景', 'HD', '闭包'])).toEqual(['闭包'])
    })

    it('最多 4 个 + 任意输入都安全', () => {
        expect(normalizeTags(['a', 'b', 'c', 'd', 'e'])).toHaveLength(4)
        expect(normalizeTags(null)).toEqual([])
        expect(normalizeTags('Vue')).toEqual([])
    })
})

const hasDb = !!process.env.TEST_DATABASE_URL

describe.skipIf(!hasDb)('existingTags (real PG)', () => {
    const USER = {
        id: 'e1000000-0000-4000-8000-000000000001',
        email: 'tags-test@test.local',
    }

    beforeAll(async () => {
        await migrate(db, {
            migrationsFolder: MIGRATIONS_FOLDER,
            migrationsTable: MIGRATIONS_TABLE,
            migrationsSchema: MIGRATIONS_SCHEMA,
        })
        await db
            .insert(users)
            .values({ ...USER, password: 'x', role: 'admin' as const })
            .onConflictDoNothing()
    })

    afterAll(async () => {
        await db.delete(tagRegistry)
        await client.end({ timeout: 2 })
    })

    it('合并 registry 与已过审题目标签,归一大小写并过滤泛词', async () => {
        await truncateBusinessTables(db)
        await db.delete(tagRegistry)
        await db.insert(tagRegistry).values([
            { slug: 'javascript', name: 'javascript' },
            { slug: 'vue', name: 'vue' },
            { slug: 'doc', name: 'doc' },
            { slug: 'hd', name: 'HD' },
        ])
        await db.insert(questions).values({
            title: '标签候选测试',
            type: 'markdown',
            content: '内容内容内容',
            answer: '答案答案答案',
            difficulty: 'easy',
            status: 'approved',
            slug: 'tags-existing-q',
            createdBy: USER.id,
            tags: ['js', '算法', '哈希', '场景'],
        })

        const tags = await existingTags()
        expect(tags).toContain('JavaScript')
        expect(tags).toContain('Vue')
        expect(tags).toContain('算法')
        expect(tags).toContain('哈希')
        // 泛词与重复项不出现
        expect(tags).not.toContain('doc')
        expect(tags).not.toContain('HD')
        expect(tags.filter((t) => t.toLowerCase() === 'javascript')).toHaveLength(1)
    })
})
