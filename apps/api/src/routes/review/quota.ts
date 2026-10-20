/**
 * quota.ts —— AI 审核每日配额(docs/abuse-defense-plan.md §1)
 *
 * 规则:每用户每天 20 次(admin 豁免);按触发计(失败也扣,LLM 调用是真实成本);
 * UTC 日期分桶;扣减走 SQL 侧自增(并发安全),超限时**不计数**直接拒绝。
 */
import { and, eq } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import db from '../../db/index.js'
import { aiQuota } from '../../db/schema.js'
import { AI_DAILY_LIMIT } from '../../lib/constants.js'

export interface QuotaState {
    /** 是否被限 */
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

/** 查询当前用量(不扣减) */
export async function getQuota(userId: string): Promise<QuotaState> {
    const [row] = await db
        .select({ used: aiQuota.used })
        .from(aiQuota)
        .where(and(eq(aiQuota.userId, userId), eq(aiQuota.day, today())))
        .limit(1)
    const used = row?.used ?? 0
    return {
        limited: used >= AI_DAILY_LIMIT,
        used,
        limit: AI_DAILY_LIMIT,
        remaining: Math.max(0, AI_DAILY_LIMIT - used),
        resetAt: resetAt(),
    }
}

/**
 * 消耗 1 次配额。返回 { ok: false, ... } 时**未计数**(超限的尝试不占额度)。
 * 单条 upsert + 条件自增,并发安全。
 */
export async function consumeQuota(userId: string): Promise<QuotaState> {
    const [row] = await db
        .insert(aiQuota)
        .values({ userId, day: today(), used: 1 })
        .onConflictDoUpdate({
            target: [aiQuota.userId, aiQuota.day],
            set: { used: sql`${aiQuota.used} + 1` },
            // 条件挂在既有行上:已到上限时不再自增 → returning 空 → 视为超限
            setWhere: sql`${aiQuota.used} < ${AI_DAILY_LIMIT}`,
        })
        .returning({ used: aiQuota.used })

    if (!row) {
        // 已到上限
        return { limited: true, used: AI_DAILY_LIMIT, limit: AI_DAILY_LIMIT, remaining: 0, resetAt: resetAt() }
    }
    return {
        limited: false,
        used: row.used,
        limit: AI_DAILY_LIMIT,
        remaining: Math.max(0, AI_DAILY_LIMIT - row.used),
        resetAt: resetAt(),
    }
}

/** admin 豁免判断直接用 role;这里不重复实现 */
