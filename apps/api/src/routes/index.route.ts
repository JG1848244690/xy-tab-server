import { createRouter } from '../lib/create-app.js'

import { createRoute, z } from '@hono/zod-openapi'
import { sql } from 'drizzle-orm'

import { jsonContent, HttpStatusCodes, createMessageObjectSchema } from '../lib/openapi.js'
import db from '../db/index.js'

const rootRoute = createRoute({
    method: 'get',
    tags: ['Index'],
    path: '/',
    responses: {
        [HttpStatusCodes.OK]: jsonContent(createMessageObjectSchema('hlsEdu api'), 'hlsEdu'),
    },
})

/**
 * /health —— 真正探到数据库的存活检查(B11)
 *
 * 以前 compose 的探针打 `/`,它不查 DB —— PG 挂了容器仍 healthy,nginx 继续转发。
 * 这里执行 SELECT 1:PG 不可达时抛错走 onError → 500,编排层据此摘除/重启实例。
 */
const healthRoute = createRoute({
    method: 'get',
    tags: ['Index'],
    path: '/health',
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({ status: z.literal('ok'), db: z.literal('up') }),
            '进程存活且数据库可达',
        ),
    },
})

const router = createRouter()
    .openapi(rootRoute, (c) => c.json({ message: 'hlsEdu api' }, HttpStatusCodes.OK))
    .openapi(healthRoute, async (c) => {
        await db.execute(sql`select 1`)
        return c.json({ status: 'ok', db: 'up' } as const, HttpStatusCodes.OK)
    })

export default router
