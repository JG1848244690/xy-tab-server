import { describe, it } from 'vitest'

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