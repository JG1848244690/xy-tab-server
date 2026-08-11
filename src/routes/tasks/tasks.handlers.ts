
import type { ListRoute, CreateRoute, GetOneRoute } from "./tasks.routes.js";
import type { AppRouteHandler } from '../../lib/types.js'
import db from '../../db/index.js'
import { task as tasks } from "../../db/schema.js"
import * as HttpStatusCodes from 'stoker/http-status-codes'
import * as HttpStatusPhrases from 'stoker/http-status-phrases'

export const list: AppRouteHandler<ListRoute> = async (c) => {
    const tasks = await db.query.task.findMany();
    return c.json(tasks)
}

export const create: AppRouteHandler<CreateRoute> = async (c) => {
    const task = c.req.valid('json')
    const [inserted] = await db.insert(tasks).values(task).returning()
    return c.json(inserted, HttpStatusCodes.OK)
}


export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
    const { id } = c.req.valid('param')
    const task = await db.query.task.findFirst({
        where(fields, operators) {
            return operators.eq(fields.id, id)
        }
    });
    if (!task) return c.json({
        message: HttpStatusPhrases.NOT_FOUND
    }, HttpStatusCodes.NOT_FOUND)
    return c.json(task, HttpStatusCodes.OK)
}