import { createHash } from 'node:crypto'
import { and, asc, eq, gte, lt, lte, sql } from 'drizzle-orm'
import db from '../../db/index.js'
import { insertTodosSchema, mcpTodoRequests, todos } from '../../db/schema.js'
import { learningDate } from '../../lib/learning-days.js'
import { createTodo } from '../todos/todos.service.js'

const todoFields = {
    id: todos.id,
    content: todos.content,
    startDate: todos.startDate,
    endDate: todos.endDate,
    completed: todos.completed,
}

type TodoResult = Pick<typeof todos.$inferSelect, keyof typeof todoFields>

function publicTodo({ id, content, startDate, endDate, completed }: TodoResult) {
    return { id, content, startDate, endDate, completed }
}

export async function createMcpTodo(userId: string, input: { content: string; date?: string; requestId?: string }) {
    const date = input.date ?? learningDate()
    const values = insertTodosSchema.parse({ content: input.content, startDate: date, endDate: date, allDay: true })
    const { requestId } = input
    if (!requestId) return publicTodo((await createTodo(userId, values))!)

    // Use the supplied date for the fingerprint so a retry after midnight still matches.
    const fingerprint = createHash('sha256').update(JSON.stringify([input.content, input.date ?? null])).digest('hex')
    return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`mcp-todo:${userId}:${requestId}`}, 0))`)
        const key = and(eq(mcpTodoRequests.userId, userId), eq(mcpTodoRequests.requestId, requestId))
        const [previous] = await tx.select().from(mcpTodoRequests).where(key).limit(1)
        const now = new Date()
        if (previous && previous.expiresAt > now) return previous.fingerprint === fingerprint ? previous.result : null
        if (previous) await tx.delete(mcpTodoRequests).where(key)

        const result = publicTodo((await createTodo(userId, values, tx))!)
        await tx.insert(mcpTodoRequests).values({
            userId, requestId, fingerprint, result, expiresAt: new Date(now.getTime() + 86_400_000),
        })
        return result
    })
}

export async function listMcpTodos(userId: string, input: {
    from?: string
    to?: string
    completed?: boolean
    query?: string
    offset?: number
    limit?: number
}) {
    const { from, to, query, completed, offset = 0, limit = 20 } = input
    const rows = await db.select(todoFields).from(todos).where(and(
        eq(todos.userId, userId),
        from ? gte(todos.endDate, from) : undefined,
        to ? lte(todos.startDate, to) : undefined,
        completed === undefined ? undefined : eq(todos.completed, completed),
        query ? sql`strpos(lower(${todos.content}), lower(${query})) > 0` : undefined,
    )).orderBy(asc(todos.startDate), asc(todos.id)).offset(offset).limit(limit + 1)
    return { items: rows.slice(0, limit), nextOffset: rows.length > limit ? offset + limit : null }
}

export function startMcpRequestRetention() {
    const prune = () => void db.delete(mcpTodoRequests).where(lt(mcpTodoRequests.expiresAt, new Date()))
        .execute().catch(() => console.warn('MCP request retention could not run'))
    prune()
    setInterval(prune, 60 * 60_000).unref()
}
