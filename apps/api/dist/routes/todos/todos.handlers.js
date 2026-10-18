import { and, asc, eq, gte, lte, or } from 'drizzle-orm';
import db from '../../db/index.js';
import { selectTodosSchema, todos } from '../../db/schema.js';
import { HttpStatusCodes } from '../../lib/openapi.js';
import { errorBody } from '../../lib/errors.js';
/** 构造 YYYY-MM-DD,避免依赖 Date 的本地时区行为 */
const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
/** 月的第一天 / 最后一天 */
const monthBounds = (year, month) => ({
    start: ymd(year, month, 1),
    end: ymd(year, month, new Date(year, month, 0).getDate()),
});
export const getMonthStatus = async (c) => {
    const userId = c.get('userId');
    const { year, month } = c.req.valid('query');
    const { start, end } = monthBounds(year, month);
    // 与该月有交集的事件(旧代码的 OR 条件:起点在月内 或 终点在月内)
    const rows = await db
        .select({ startDate: todos.startDate, completed: todos.completed })
        .from(todos)
        .where(and(eq(todos.userId, userId), or(and(gte(todos.startDate, start), lte(todos.startDate, end)), and(gte(todos.endDate, start), lte(todos.endDate, end)))));
    /**
     * 注意:旧 MySQL 实现只把 startDate 记进 dateMap,跨天事件的中间日期不会被打标。
     * 这里保持同样行为 —— 前端月历是照这个行为做的,改了会多出预期外的圆点。
     */
    const dateMap = new Map();
    for (const row of rows) {
        const key = row.startDate;
        if (!dateMap.has(key))
            dateMap.set(key, true);
        if (!row.completed)
            dateMap.set(key, false);
    }
    const completed = [];
    const incomplete = [];
    dateMap.forEach((isCompleted, date) => {
        ;
        (isCompleted ? completed : incomplete).push(date);
    });
    return c.json({ completed, incomplete }, HttpStatusCodes.OK);
};
export const getByDate = async (c) => {
    const userId = c.get('userId');
    const { date } = c.req.valid('query');
    // start_date <= date AND end_date >= date —— 覆盖跨天事件
    const rows = await db
        .select()
        .from(todos)
        .where(and(eq(todos.userId, userId), lte(todos.startDate, date), gte(todos.endDate, date)))
        .orderBy(asc(todos.startTime));
    return c.json(rows);
};
export const getByMonth = async (c) => {
    const userId = c.get('userId');
    const { year, month } = c.req.valid('query');
    const { start, end } = monthBounds(year, month);
    const rows = await db
        .select()
        .from(todos)
        .where(and(eq(todos.userId, userId), or(and(gte(todos.startDate, start), lte(todos.startDate, end)), and(gte(todos.endDate, start), lte(todos.endDate, end)))))
        .orderBy(asc(todos.startDate), asc(todos.startTime));
    return c.json(rows);
};
export const create = async (c) => {
    const userId = c.get('userId');
    const body = c.req.valid('json');
    const [created] = await db.insert(todos).values({ ...body, userId }).returning();
    return c.json(selectTodosSchema.parse(created), HttpStatusCodes.OK);
};
export const update = async (c) => {
    const { id } = c.req.valid('param');
    const userId = c.get('userId');
    const body = c.req.valid('json');
    // user_id 一起带上条件,防止改到别人的 todo
    const [updated] = await db
        .update(todos)
        .set(body)
        .where(and(eq(todos.id, id), eq(todos.userId, userId)))
        .returning();
    if (!updated)
        return c.json(errorBody('Todo not found', 'NOT_FOUND'), HttpStatusCodes.NOT_FOUND);
    return c.json(selectTodosSchema.parse(updated), HttpStatusCodes.OK);
};
export const remove = async (c) => {
    const { id } = c.req.valid('param');
    const userId = c.get('userId');
    const [deleted] = await db
        .delete(todos)
        .where(and(eq(todos.id, id), eq(todos.userId, userId)))
        .returning({ id: todos.id });
    if (!deleted)
        return c.json(errorBody('Todo not found', 'NOT_FOUND'), HttpStatusCodes.NOT_FOUND);
    return c.json({ success: true }, HttpStatusCodes.OK);
};
export const toggle = async (c) => {
    const { id } = c.req.valid('param');
    const userId = c.get('userId');
    const [existing] = await db
        .select({ completed: todos.completed })
        .from(todos)
        .where(and(eq(todos.id, id), eq(todos.userId, userId)))
        .limit(1);
    if (!existing)
        return c.json(errorBody('Todo not found', 'NOT_FOUND'), HttpStatusCodes.NOT_FOUND);
    const [updated] = await db
        .update(todos)
        .set({ completed: !existing.completed })
        .where(and(eq(todos.id, id), eq(todos.userId, userId)))
        .returning({ id: todos.id, completed: todos.completed });
    return c.json(updated, HttpStatusCodes.OK);
};
