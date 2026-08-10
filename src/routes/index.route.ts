import { createRouter } from "../lib/create-app.js";

import { createRoute } from '@hono/zod-openapi'

import { jsonContent } from "stoker/openapi/helpers";
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { createMessageObjectSchema } from "stoker/openapi/schemas";

const router = createRouter()
    .openapi(
        createRoute(
            {
                method: 'get',
                tags: ['Index'],
                path: '/',
                responses: {
                    [HttpStatusCodes.OK]: jsonContent(
                        createMessageObjectSchema('tasks api'),
                        'task'
                    )

                }
            }),
        (c) => {
            return c.json({
                message: 'task'
            }, HttpStatusCodes.OK)
        }
    )
    // .openapi()

export default router;