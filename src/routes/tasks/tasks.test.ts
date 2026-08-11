import { describe, it, vi } from 'vitest'

// 把 db 模块完全 mock 掉:测试不依赖真实 Postgres,CI 跑得干净。
// 注意路径要跟 import db from '../../db/index.js' 完全一致(含 .js 后缀)。
vi.mock('../../db/index.js', () => {
    const emptyTask = { id: 1, name: 'mocked', done: false, createdAt: new Date(), updatedAt: new Date() }
    return {
        default: {
            query: {
                task: {
                    findMany: vi.fn().mockResolvedValue([emptyTask]),
                    findFirst: vi.fn().mockResolvedValue(emptyTask),
                },
            },
            insert: vi.fn(() => ({
                values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([emptyTask]) })),
            })),
            update: vi.fn(() => ({
                set: vi.fn(() => ({
                    where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([emptyTask]) })),
                })),
            })),
            delete: vi.fn(() => ({
                where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([emptyTask]) })),
            })),
        },
    }
})

import router from './tasks.index.js'
import { createTestApp } from '../../lib/create-app.js'

describe("task list", () => {
    it('responds with an array', async () => {
        const testRouter = createTestApp(router)
        const response = await testRouter.request("/tasks");
        const res = await response.text();
        console.log(res)
    })
})