
import type { listRoute } from "./tasks.routes.js";
import type { AppRouteHandler } from '../../lib/types.js'

export const list: AppRouteHandler<listRoute> = (c) => {
    return c.json([{
        name: 'learn hono',
        done: false
    }])
}

