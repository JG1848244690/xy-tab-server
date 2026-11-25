import { z } from '@hono/zod-openapi'
import { and, count, desc, eq, gte, ilike, inArray, isNull, sql } from 'drizzle-orm'
import db from '../../db/index.js'
import { systemEvents, users } from '../../db/schema.js'
import { createRouter } from '../../lib/create-app.js'
import { auditCutoff, recordSystemEvent, systemActions } from '../../lib/system-audit.js'
import { readHostSnapshot } from './host-snapshot.js'

const pageSize = 20
const pagination = z.coerce.number().int().min(1).max(10_000).default(1)
const userQuery = z.object({ page: pagination, filter: z.enum(['all', 'day', 'week', 'unverified']).default('all'), q: z.string().trim().max(100).optional() })
const actionQuery = z.object({ page: pagination, action: z.enum(['security', ...systemActions]).default('security') })

const userFields = {
    id: users.id, name: users.username, email: users.email, role: users.role,
    createdAt: users.createdAt, verifiedAt: users.emailVerifiedAt,
}

function maskedEmail(email: string) {
    const domain = email.split('@').at(-1) ?? ''
    const suffix = domain.includes('.') ? '.' + domain.split('.').at(-1) : ''
    return `${email.slice(0, 1)}***@${domain.slice(0, 1)}***${suffix}`
}

function userSummary({ email, ...user }: { email: string } & Omit<typeof users.$inferSelect, 'email' | 'username' | 'emailVerifiedAt' | 'password' | 'createdIpHash' | 'avatarPath' | 'updatedAt'> & {
    name: string | null; verifiedAt: Date | null; lastLogin?: Date | null
}) {
    return { ...user, email: maskedEmail(email) }
}

const router = createRouter()

router.get('/admin/monitor/summary', async (c) => {
    const recent = new Date(Date.now() - 15 * 60_000)
    const day = new Date(Date.now() - 24 * 3600_000)
    const [[registrations], [security], [database], host] = await Promise.all([
        db.select({ total: count() }).from(users).where(gte(users.createdAt, day)),
        db.select({
            failedLogins: sql<number>`count(*) filter (where ${systemEvents.action} = 'login' and ${systemEvents.status} >= 400)::int`,
            registrationBlocks: sql<number>`count(*) filter (where ${systemEvents.action} = 'register_limit')::int`,
            errors: sql<number>`count(*) filter (where ${systemEvents.action} = 'api_error')::int`,
        }).from(systemEvents).where(gte(systemEvents.createdAt, recent)),
        db.execute<{ bytes: string }>(sql`select pg_database_size(current_database()) as bytes`),
        readHostSnapshot(),
    ])
    const [source] = await db.select({ total: count() }).from(systemEvents).where(and(
        gte(systemEvents.createdAt, recent), eq(systemEvents.action, 'login'), gte(systemEvents.status, 400),
        sql`${systemEvents.source} is not null`,
    )).groupBy(systemEvents.source).orderBy(desc(count())).limit(1)

    return c.json({ registrations: registrations!.total, ...security!, maxFailuresFromSource: source?.total ?? 0,
        databaseBytes: Number(database!.bytes), host })
})

router.get('/admin/monitor/users', async (c) => {
    const parsed = userQuery.safeParse(c.req.query())
    if (!parsed.success) return c.json({ message: '用户列表筛选条件无效' }, 400)
    const { filter, q, page } = parsed.data
    const filterCondition = filter === 'unverified' ? isNull(users.emailVerifiedAt)
        : filter === 'day' || filter === 'week' ? gte(users.createdAt, new Date(Date.now() - (filter === 'day' ? 1 : 7) * 86400_000)) : undefined
    const search = q ? ilike(users.username, `%${q}%`) : undefined
    const rows = await db.select({
        ...userFields,
        lastLogin: sql<Date | null>`(select max(created_at) from system_events where actor_id = "users"."id"
            and action = 'login' and status = 200 and created_at >= ${auditCutoff().toISOString()}::timestamptz)`.mapWith(systemEvents.createdAt),
    }).from(users).where(and(filterCondition, search)).orderBy(desc(users.createdAt), desc(users.id))
        .limit(pageSize + 1).offset((page - 1) * pageSize)
    return c.json({ data: rows.slice(0, pageSize).map(userSummary), hasMore: rows.length > pageSize })
})

router.get('/admin/monitor/users/:id', async (c) => {
    const id = z.string().uuid().safeParse(c.req.param('id'))
    if (!id.success) return c.json({ message: '无效账号' }, 400)
    const [user] = await db.select(userFields).from(users).where(eq(users.id, id.data))
    if (!user) return c.json({ message: '账号不存在' }, 404)
    await recordSystemEvent({ action: 'admin_user_viewed', status: 200, targetId: id.data, actorId: c.get('userId'), requestId: c.get('requestId') })
    const activity = await db.select({ id: systemEvents.id, action: systemEvents.action, status: systemEvents.status,
        createdAt: systemEvents.createdAt }).from(systemEvents)
        .where(and(eq(systemEvents.actorId, id.data), gte(systemEvents.createdAt, auditCutoff())))
        .orderBy(desc(systemEvents.createdAt), desc(systemEvents.id)).limit(50)
    return c.json({ user: userSummary(user), activity })
})

router.get('/admin/monitor/events', async (c) => {
    const parsed = actionQuery.safeParse(c.req.query())
    if (!parsed.success) return c.json({ message: '事件筛选条件无效' }, 400)
    const { action, page } = parsed.data
    const securityActions = ['login', 'register_limit', 'access_denied', 'api_error', 'question_deleted', 'question_reviewed', 'admin_user_viewed']
    const rows = await db.select({ id: systemEvents.id, action: systemEvents.action, status: systemEvents.status,
        actor: users.username, actorId: systemEvents.actorId, targetId: systemEvents.targetId,
        requestId: systemEvents.requestId, source: systemEvents.source, createdAt: systemEvents.createdAt,
    }).from(systemEvents).leftJoin(users, eq(systemEvents.actorId, users.id))
        .where(and(gte(systemEvents.createdAt, auditCutoff()), action === 'security'
            ? inArray(systemEvents.action, securityActions) : eq(systemEvents.action, action)))
        .orderBy(desc(systemEvents.createdAt), desc(systemEvents.id)).limit(pageSize + 1).offset((page - 1) * pageSize)
    return c.json({ data: rows.slice(0, pageSize), hasMore: rows.length > pageSize })
})

export default router
