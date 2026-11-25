import { createHmac } from 'node:crypto'
import { createMiddleware } from 'hono/factory'
import { lt } from 'drizzle-orm'
import db from '../db/index.js'
import { systemEvents } from '../db/schema.js'
import env from '../env.js'
import { clientIp } from './client-ip.js'
import type { AppBindings } from './types.js'

export const systemActions = [
    'login', 'register_limit', 'access_denied', 'api_error', 'practice',
    'question_created', 'question_deleted', 'question_reviewed', 'admin_user_viewed',
] as const
type Action = typeof systemActions[number]

const questionPath = /^\/questions\/([0-9a-f-]{36})(?:\/(submit))?$/i
const reviewPath = /^\/review\/([0-9a-f-]{36})\/human$/i
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const retention = 30 * 24 * 60 * 60 * 1000
export const auditCutoff = () => new Date(Date.now() - retention)

export async function recordSystemEvent(event: Omit<typeof systemEvents.$inferInsert, 'action'> & { action: Action }) {
    await db.insert(systemEvents).values(event)
}

export function startAuditRetention() {
    const prune = () => db.delete(systemEvents).where(lt(systemEvents.createdAt, auditCutoff()))
        .execute().catch(() => console.warn('system audit retention could not run'))
    void prune()
    setInterval(() => void prune(), 24 * 60 * 60 * 1000).unref()
}

// Bound writes from rejected requests. Successful audit events remain available even under abuse.
let failureMinute = -1
let failuresRecorded = 0
function allowFailureEvent() {
    const minute = Math.floor(Date.now() / 60_000)
    if (failureMinute !== minute) {
        failureMinute = minute
        failuresRecorded = 0
    }
    return failuresRecorded++ < 120
}

export const systemAudit = createMiddleware<AppBindings>(async (c, next) => {
    await next()
    const path = c.req.path.replace(/\/$/, '')
    const method = c.req.method
    const status = c.res.status
    let action: Action | undefined
    let target: string | undefined

    if (status >= 500 && path !== '/health' && !path.startsWith('/admin/monitor')) {
        action = 'api_error'
    } else if (method === 'POST' && path === '/auth/login' && [200, 401, 429].includes(status)) {
        action = 'login'
    } else if (method === 'POST' && path === '/auth/register' && (status === 429 || status === 403)) {
        action = 'register_limit'
    } else if (status === 403) {
        action = 'access_denied'
    } else if (status >= 200 && status < 300) {
        const question = path.match(questionPath)
        const review = path.match(reviewPath)
        if (method === 'POST' && question?.[2] === 'submit') action = 'practice'
        if (method === 'POST' && path === '/questions') action = 'question_created'
        if (method === 'DELETE' && question && !question[2]) action = 'question_deleted'
        if (method === 'POST' && review) action = 'question_reviewed'
        target = question?.[1] ?? review?.[1]
    }

    if (!action || (status >= 400 && !allowFailureEvent())) return
    const ip = status >= 400 ? clientIp(c) : 'unknown'
    const source = ip === 'unknown' ? undefined : createHmac('sha256', env.JWT_SECRET)
        .update(`monitor-source:${ip}`).digest('hex').slice(0, 16)
    try {
        await recordSystemEvent({
            action, status, source, actorId: c.get('userId'),
            targetId: target && uuid.test(target) ? target : undefined,
            requestId: c.get('requestId'),
        })
    } catch {
        c.get('logger')?.warn('system audit event could not be saved')
    }
})
