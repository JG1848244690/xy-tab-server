import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { bodyLimit } from 'hono/body-limit'
import { z } from 'zod'
import env from '../../env.js'
import { createRouter } from '../../lib/create-app.js'
import { rateLimit } from '../../middlewares/rate-limit.js'
import { completeTodo } from '../todos/todos.service.js'
import { authenticateMcpKey } from './mcp-keys.js'
import { createMcpTodo, listMcpTodos } from './mcp-todos.js'
import { authenticateOAuth, oauthChallenge } from './oauth/resource.js'

const calendarDate = z.string().date()
const todoOutput = z.object({
    id: z.string().uuid(),
    content: z.string(),
    startDate: calendarDate,
    endDate: calendarDate,
    completed: z.boolean(),
})
const allowedOrigins = env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
const result = <T extends Record<string, unknown>>(data: T) => ({
    structuredContent: data,
    content: [{ type: 'text' as const, text: JSON.stringify(data) }],
})
const toolError = (message: string) => ({
    isError: true,
    content: [{ type: 'text' as const, text: message }],
})

const router = createRouter()
router.all('/mcp', rateLimit({ windowMs: 60_000, max: 120 }), bodyLimit({ maxSize: 32_768 }), async (c) => {
    c.header('Cache-Control', 'private, no-store')
    const origin = c.req.header('Origin')
    if (origin && origin !== new URL(c.req.url).origin && !allowedOrigins.includes(origin)) {
        return c.json({ message: 'Origin not allowed' }, 403)
    }

    const authorization = c.req.header('Authorization')
    const personalKey = /^Bearer hlse_mcp_/i.test(authorization ?? '')
    const key = personalKey ? await authenticateMcpKey(authorization) : await authenticateOAuth(authorization)
    if (!key) {
        c.header('WWW-Authenticate', oauthChallenge(authorization ? 'invalid_token' : undefined))
        return c.json({ message: 'A valid hlsEdu MCP credential is required' }, 401)
    }
    const { userId, id: keyId, canWrite } = key
    c.set('userId', userId)

    if (!personalKey && !canWrite && c.req.method === 'POST') {
        const rpc = await c.req.raw.clone().json().catch(() => undefined)
        if (rpc?.method === 'tools/call' && ['create_todo', 'complete_todo'].includes(rpc.params?.name)) {
            c.header('WWW-Authenticate', oauthChallenge('insufficient_scope'))
            return c.json({ message: 'Authorize todos:write to modify todos' }, 403)
        }
    }

    const server = new McpServer({ name: 'hlsedu', version: '1.0.0' })
    function logCall(tool: string, outcome: string, targetId?: string) {
        c.get('logger')?.info({ tool, outcome, targetId, userId, keyId }, 'MCP tool call')
    }
    async function runOperation<T>(tool: string, operation: () => Promise<T>) {
        try {
            return await operation()
        } catch {
            c.get('logger')?.error({ tool, userId, keyId, requestId: c.get('requestId') }, 'MCP tool operation failed')
            // Database errors can include SQL parameters, including private todo text.
            throw new Error('The todo operation failed. Reference: ' + c.get('requestId'))
        }
    }

    server.registerTool('list_todos', {
        description: 'List the current user’s todos. Filter by overlapping date range, completion state, or a literal substring. Use the returned ID to complete a todo. Ask the user to choose if several results match.',
        inputSchema: z.object({
            from: calendarDate.optional().describe('First day, inclusive (YYYY-MM-DD)'),
            to: calendarDate.optional().describe('Last day, inclusive (YYYY-MM-DD)'),
            completed: z.boolean().optional(),
            query: z.string().trim().min(1).max(200).optional(),
            offset: z.number().int().min(0).max(2_147_483_647).optional(),
            limit: z.number().int().min(1).max(50).optional(),
        }).strict(),
        outputSchema: z.object({ items: z.array(todoOutput), nextOffset: z.number().int().nullable() }),
        annotations: { readOnlyHint: true, openWorldHint: false },
    }, async (input) => {
        if (input.from && input.to && input.from > input.to) {
            logCall('list_todos', 'invalid_date_range')
            return toolError('The from date must be on or before the to date.')
        }
        const page = await runOperation('list_todos', () => listMcpTodos(userId, input))
        logCall('list_todos', 'success')
        return result(page)
    })

    if (canWrite) {
        server.registerTool('create_todo', {
            description: 'Create one all-day todo for the current user. If no date is supplied, use today in Asia/Shanghai. Reuse the same requestId when retrying the same creation within 24 hours.',
            inputSchema: z.object({
                content: z.string().trim().min(1).max(500),
                date: calendarDate.optional().describe('Todo date (YYYY-MM-DD)'),
                requestId: z.string().trim().min(1).max(100).optional(),
            }).strict(),
            outputSchema: todoOutput,
            annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
        }, async (input) => {
            const todo = await runOperation('create_todo', () => createMcpTodo(userId, input))
            logCall('create_todo', todo ? 'success' : 'request_id_conflict', todo?.id)
            return todo ? result(todo) : toolError('This requestId was already used with different input.')
        })

        server.registerTool('complete_todo', {
            description: 'Mark one todo as completed. Use its exact ID. If the user refers to a todo by text, call list_todos first and ask the user to choose when there are several matches.',
            inputSchema: z.object({ id: z.string().uuid() }).strict(),
            outputSchema: todoOutput.pick({ id: true, completed: true }),
            annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        }, async ({ id }) => {
            const todo = await runOperation('complete_todo', () => completeTodo(userId, id))
            logCall('complete_todo', todo ? 'success' : 'not_found', todo?.id)
            return todo ? result(todo) : toolError('Todo not found.')
        })
    }

    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true })
    try {
        await server.connect(transport)
        return await transport.handleRequest(c.req.raw)
    } finally {
        await server.close()
    }
})

export default router
