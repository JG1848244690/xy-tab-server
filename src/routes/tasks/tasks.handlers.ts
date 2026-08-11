
import type { ListRoute, CreateRoute, GetOneRoute, PatchRoute, RemoveRoute } from "./tasks.routes.js";
import type { AppRouteHandler } from '../../lib/types.js'
import db from '../../db/index.js'
import { task } from "../../db/schema.js"
import { eq } from 'drizzle-orm'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import * as HttpStatusPhrases from 'stoker/http-status-phrases'

export const list: AppRouteHandler<ListRoute> = async (c) => {
    const tasks = await db.query.task.findMany();
    return c.json(tasks)
}

export const create: AppRouteHandler<CreateRoute> = async (c) => {
    const body = c.req.valid('json')
    const [inserted] = await db.insert(task).values(body).returning()
    return c.json(inserted, HttpStatusCodes.OK)
}


export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
    const { id } = c.req.valid('param')
    const found = await db.query.task.findFirst({
        where(fields, operators) {
            return operators.eq(fields.id, id)
        }
    });
    if (!found) return c.json({
        message: HttpStatusPhrases.NOT_FOUND
    }, HttpStatusCodes.NOT_FOUND)
    return c.json(found, HttpStatusCodes.OK)
}

export const patch: AppRouteHandler<PatchRoute> = async (c) => {
    const { id } = c.req.valid('param')
    const updates = c.req.valid('json')
    const [updated] = await db.update(task)
        .set(updates)
        .where(eq(task.id, id))
        .returning()
    if (!updated) return c.json({
        message: HttpStatusPhrases.NOT_FOUND
    }, HttpStatusCodes.NOT_FOUND)
    return c.json(updated, HttpStatusCodes.OK)
}

export const remove: AppRouteHandler<RemoveRoute> = async (c) => {
    const { id } = c.req.valid('param')
    const [deleted] = await db.delete(task)
        .where(eq(task.id, id))
        .returning()
    if (!deleted) return c.json({
        message: HttpStatusPhrases.NOT_FOUND
    }, HttpStatusCodes.NOT_FOUND)
    return c.body(null, HttpStatusCodes.NO_CONTENT)
}