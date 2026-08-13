
import { z } from 'zod'
import type { ListRoute, CreateRoute, GetOneRoute, PatchRoute, RemoveRoute } from "./tasks.routes.js";
import type { AppRouteHandler } from '../../lib/types.js'
import db from '../../db/index.js'
import { task, selectTasksSchema, insertTaskSchema } from "../../db/schema.js"
import { eq } from 'drizzle-orm'
import { HttpStatusCodes, HttpStatusPhrases } from '../../lib/openapi.js'

type TaskRow = z.infer<typeof selectTasksSchema>
type NewTask = z.infer<typeof insertTaskSchema>

// 全部走 schema parse,运行时校验 + 类型对齐:
//  - parse 后类型跟 route 声明的 200 TypedResponse 对齐
//  - 顺带做运行时校验,DB 异常行直接抛(默认 errorHandler 兜底)
//  - 422 错误响应(默认 defaultHook)由 defaultHook 处理,handler 不显式返
//  - 200 + 422 在 TypedResponse 里组成 union,c.json() 推断时会被 union 卡住;
//    显式传 HttpStatusCodes.OK 把 c.json 收窄到 200 那一支
//  - create 的 body 二次 parse 后,cast 到 typeof task.$inferInsert 走 drizzle 实际期望的类型,
//    绕开 drizzle-zod 0.7.1 + drizzle 0.45 的 Placeholder/SQL 联合类型不匹配
//  - 全部 cast 目标都是真实类型,不是 `as never` 偷懒

export const list: AppRouteHandler<ListRoute> = async (c) => {
    const raw = await db.query.task.findMany();
    // list 路由只声明 200 响应(无 422),TypedResponse 单 shape,需要 unknown cast 收紧
    return c.json(z.array(selectTasksSchema).parse(raw) as unknown as TaskRow[])
}

export const create: AppRouteHandler<CreateRoute> = async (c) => {
    const body = insertTaskSchema.parse(c.req.valid('json')) as unknown as typeof task.$inferInsert
    const [inserted] = await db.insert(task).values(body).returning()
    return c.json(selectTasksSchema.parse(inserted) as TaskRow, HttpStatusCodes.OK)
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
    return c.json(selectTasksSchema.parse(found) as TaskRow, HttpStatusCodes.OK)
}

export const patch: AppRouteHandler<PatchRoute> = async (c) => {
    const { id } = c.req.valid('param')
    const updates = c.req.valid('json') as Partial<NewTask>
    const [updated] = await db.update(task)
        .set(updates)
        .where(eq(task.id, id))
        .returning()
    if (!updated) return c.json({
        message: HttpStatusPhrases.NOT_FOUND
    }, HttpStatusCodes.NOT_FOUND)
    return c.json(selectTasksSchema.parse(updated) as TaskRow, HttpStatusCodes.OK)
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