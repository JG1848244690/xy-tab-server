import { createRouter } from '../lib/create-app.js'

import { createRoute } from '@hono/zod-openapi'

import { jsonContent, HttpStatusCodes, createMessageObjectSchema } from '../lib/openapi.js'

const router = createRouter().openapi(
    createRoute({
        method: 'get',
        tags: ['Index'],
        path: '/',
        responses: {
            [HttpStatusCodes.OK]: jsonContent(createMessageObjectSchema('hlsEdu api'), 'hlsEdu'),
        },
    }),
    (c) => {
        return c.json({ message: 'hlsEdu api' }, HttpStatusCodes.OK)
    },
)

export default router