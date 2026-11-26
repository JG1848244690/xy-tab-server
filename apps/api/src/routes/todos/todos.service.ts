import { and, eq, sql } from 'drizzle-orm'
import type { z } from 'zod'
import db from '../../db/index.js'
import { todos, type insertTodosSchema } from '../../db/schema.js'

export function createTodo(
    userId: string,
    input: z.output<typeof insertTodosSchema>,
    writer: Pick<typeof db, 'insert'> = db,
) {
    return writer.insert(todos).values({ ...input, userId }).returning().then(([created]) => created)
}

export function updateTodo(userId: string, id: string, input: Partial<z.output<typeof insertTodosSchema>>) {
    return db.update(todos).set(input)
        .where(and(eq(todos.id, id), eq(todos.userId, userId)))
        .returning().then(([updated]) => updated)
}

export async function completeTodo(userId: string, id: string) {
    const [updated] = await db.update(todos)
        .set({ completed: true, updatedAt: sql`case when ${todos.completed} then ${todos.updatedAt} else now() end` })
        .where(and(eq(todos.id, id), eq(todos.userId, userId)))
        .returning({ id: todos.id, completed: todos.completed })
    return updated
}
