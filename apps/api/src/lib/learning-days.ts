import { sql } from 'drizzle-orm'
import type db from '../db/index.js'

const beijingDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
})

export function learningDate(now = new Date()) {
    return beijingDate.format(now)
}

export function shiftLearningDate(day: string, days: number) {
    const date = new Date(`${day}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + days)
    return date.toISOString().slice(0, 10)
}

export function startLearningWeek(day: string) {
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay()
    return shiftLearningDate(day, -((weekday + 6) % 7))
}

export async function learningStreak(executor: Pick<typeof db, 'execute'>, userId: string, day: string) {
    const [row] = await executor.execute<{ days: number }>(sql`
        with recursive streak(day) as (
            (select day from learning_days
             where user_id = ${userId} and day between ${day}::date - 1 and ${day}::date
             order by day desc limit 1)
            union all
            select previous.day from streak
            join learning_days previous on previous.user_id = ${userId} and previous.day = streak.day - 1
        )
        select count(*)::int as days from streak
    `)
    return row!.days
}
