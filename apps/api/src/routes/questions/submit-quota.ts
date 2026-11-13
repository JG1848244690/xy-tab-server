/**
 * 投稿配额(2026-11-13)
 *
 * 和 AI 审核配额同构:每用户每天一行,SQL 侧自增,并发安全。
 * 为什么不用「count(questions where createdAt > now-24h)」:
 * 删题之后行就没了,「提交 → 撤回 → 再提交」可以无限刷,
 * 而投稿队列本身会被反复灌。计数必须独立于业务行。
 */
import { and, count, eq, inArray, sql } from 'drizzle-orm'
import db from '../../db/index.js'
import { questionQuota, questions } from '../../db/schema.js'
import { QUESTION_DAILY_LIMIT, QUESTION_PENDING_LIMIT } from '../../lib/constants.js'

export interface SubmitQuotaState {
    limited: boolean
    used: number
    limit: number
    remaining: number
    /** 下次重置时间(UTC 次日 0 点) */
    resetAt: string
}

function today(): string {
    return new Date().toISOString().slice(0, 10)
}

function resetAt(): string {
    const t = new Date()
    return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + 1)).toISOString()
}

export async function getSubmitQuota(userId: string): Promise<SubmitQuotaState> {
    const [row] = await db
        .select({ used: questionQuota.used })
        .from(questionQuota)
        .where(and(eq(questionQuota.userId, userId), eq(questionQuota.day, today())))
        .limit(1)
    const used = row?.used ?? 0
    return {
        limited: used >= QUESTION_DAILY_LIMIT,
        used,
        limit: QUESTION_DAILY_LIMIT,
        remaining: Math.max(0, QUESTION_DAILY_LIMIT - used),
        resetAt: resetAt(),
    }
}

/** 消耗 1 次投稿额度;超限时**不计数**,直接返回 limited */
export async function consumeSubmitQuota(userId: string): Promise<SubmitQuotaState> {
    const [row] = await db
        .insert(questionQuota)
        .values({ userId, day: today(), used: 1 })
        .onConflictDoUpdate({
            target: [questionQuota.userId, questionQuota.day],
            set: { used: sql`${questionQuota.used} + 1` },
            setWhere: sql`${questionQuota.used} < ${QUESTION_DAILY_LIMIT}`,
        })
        .returning({ used: questionQuota.used })

    if (!row) {
        return {
            limited: true,
            used: QUESTION_DAILY_LIMIT,
            limit: QUESTION_DAILY_LIMIT,
            remaining: 0,
            resetAt: resetAt(),
        }
    }
    return {
        limited: false,
        used: row.used,
        limit: QUESTION_DAILY_LIMIT,
        remaining: Math.max(0, QUESTION_DAILY_LIMIT - row.used),
        resetAt: resetAt(),
    }
}

/** 该用户在审核队列里(未裁决)的投稿数 */
export async function countPendingSubmissions(userId: string): Promise<number> {
    const [row] = await db
        .select({ value: count() })
        .from(questions)
        .where(
            and(
                eq(questions.createdBy, userId),
                inArray(questions.status, ['draft', 'pending_review', 'human_pending']),
            ),
        )
    return Number(row?.value ?? 0)
}

export { QUESTION_PENDING_LIMIT }
