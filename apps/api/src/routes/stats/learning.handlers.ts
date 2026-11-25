import { and, eq, gte, lte, sql } from 'drizzle-orm'
import db from '../../db/index.js'
import { learningDays, learningLeaderboardMembers, users } from '../../db/schema.js'
import { learningDate, learningStreak, shiftLearningDate, startLearningWeek } from '../../lib/learning-days.js'
import { HttpStatusCodes } from '../../lib/openapi.js'
import type { AppRouteHandler } from '../../lib/types.js'
import type * as routes from './learning.routes.js'

const PAGE_SIZE = 10

type RankRow = { alias: string; days: number; rank: number; isMe: boolean; position: number }

export const learning: AppRouteHandler<typeof routes.learning> = async (c) => {
    const userId = c.get('userId')!
    const { page } = c.req.valid('query')
    const today = learningDate()
    const monday = startLearningWeek(today)
    const offset = (page - 1) * PAGE_SIZE

    const [personalDays, streak, [preference], ranks] = await Promise.all([
        db.select({ day: learningDays.day }).from(learningDays).where(and(
            eq(learningDays.userId, userId), gte(learningDays.day, monday), lte(learningDays.day, today),
        )),
        learningStreak(db, userId, today),
        db.select({ verified: users.emailVerifiedAt, enabled: learningLeaderboardMembers.enabled })
            .from(users).leftJoin(learningLeaderboardMembers, eq(learningLeaderboardMembers.userId, users.id))
            .where(eq(users.id, userId)),
        db.execute<RankRow>(sql`
            with ranked as (
                select '同学 ' || left(replace(m.alias_id::text, '-', ''), 12) as alias,
                       count(*)::int as days,
                       rank() over (order by count(*) desc)::int as rank,
                       row_number() over (order by count(*) desc, m.alias_id, m.user_id)::int as position,
                       m.user_id = ${userId} as "isMe"
                from learning_leaderboard_members m
                join users u on u.id = m.user_id and u.email_verified_at is not null
                join learning_days d on d.user_id = m.user_id and d.day between ${monday} and ${today}
                where m.enabled
                group by m.user_id, m.alias_id
            )
            select * from ranked
            where position between ${offset + 1} and ${offset + PAGE_SIZE + 1} or "isMe"
            order by position
        `),
    ])

    const completedDays = new Set(personalDays.map(({ day }) => day))
    const week = Array.from({ length: 7 }, (_, index) => {
        const date = shiftLearningDate(monday, index)
        return { date, completed: completedDays.has(date) }
    })
    const publicRow = ({ alias, days, rank, isMe }: RankRow) => ({ alias, days, rank, isMe })
    const me = ranks.find((row) => row.isMe)

    c.header('Cache-Control', 'private, no-store')
    return c.json({
        today,
        week,
        streak,
        enabled: Boolean(preference?.enabled && preference.verified),
        canJoin: Boolean(preference?.verified),
        myRank: me ? publicRow(me) : null,
        leaderboard: ranks.filter(({ position }) => position > offset && position <= offset + PAGE_SIZE).map(publicRow),
        hasMore: ranks.some(({ position }) => position === offset + PAGE_SIZE + 1),
    }, HttpStatusCodes.OK)
}

export const learningPreference: AppRouteHandler<typeof routes.learningPreference> = async (c) => {
    const userId = c.get('userId')!
    const { enabled } = c.req.valid('json')
    if (enabled) {
        const [user] = await db.select({ verified: users.emailVerifiedAt }).from(users).where(eq(users.id, userId))
        if (!user?.verified) return c.json({ message: '验证邮箱后可以加入周榜' }, HttpStatusCodes.FORBIDDEN)
    }
    await db.insert(learningLeaderboardMembers).values({ userId, enabled })
        .onConflictDoUpdate({ target: learningLeaderboardMembers.userId, set: { enabled } })
    return c.json({ enabled }, HttpStatusCodes.OK)
}
