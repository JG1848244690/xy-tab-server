
import type { listRoute } from "./tasks.routes.js";
import type { AppRouteHandler } from '../../lib/types.js'
import db from '../../db/index.js'
export const list: AppRouteHandler<listRoute> = async (c) => {
    const tasks = await db.query.task.findMany();
    return c.json(tasks)
}

