/**
 * agent.ts —— 审核执行体(面试站 P0,plan §2.3;2026-10-20 修订:人工审核强制)
 *
 * 设计:
 *  - 进程内异步,不引入队列中间件(1.6G 小服务器没预算);
 *    inFlight Set 去重并发触发,进程重启丢队列由 /review/stale 兜底重跑
 *  - contentHash 幂等:题目没改就不重审(省 token,防重复发布动作)
 *  - 触发即置 pending_review;LLM 挂了留在该状态并落失败日志,不阻塞别人
 *  - AI 只是前置筛选:高分 → human_pending(人工队列),低分 → rejected(打回留档);
 *    只有人工「通过」才 approved + publishedAt(见 docs/review-workflow-plan.md)
 */
import { createHash } from 'node:crypto'
import { and, desc, eq, ne } from 'drizzle-orm'
import db from '../../db/index.js'
import { questions, reviewLogs } from '../../db/schema.js'
import { LLM_JSON_RETRY, REVIEW_THRESHOLDS } from '../../lib/constants.js'
import { LlmError, agentReportSchema, chatJsonWithRetry, llmConfigured, llmConfig } from './llm.js'
import type { AgentReport } from './llm.js'
import { reviewSystemPrompt } from './prompts/system.js'
import { reviewRubricPrompt } from './prompts/rubric.js'
import { reviewOutputPrompt } from './prompts/output.js'

/** 题目内容指纹:任一字符改动都会换 hash → 触发重审 */
export const contentHashOf = (q: { title: string; content: string; answer: string }) =>
    createHash('sha256').update(`${q.title}\n${q.content}\n${q.answer}`).digest('hex')

/** 正在审核中的题目 id(进程内;重启即空,stale 兜底) */
const inFlight = new Set<string>()

export function isReviewing(questionId: string): boolean {
    return inFlight.has(questionId)
}

/**
 * AI 判定 → 下一状态(人工审核强制:AI 不再自动发布)
 *   total ≥ MIN(60) → 'human_pending'(进人工审核队列)
 *   total < MIN(60) → 'rejected'(AI 打回,报告留档)
 * isHighConfidence(≥85)只是展示/排序指标,见 lib/constants.ts
 */
export function verdictOf(total: number): 'human_pending' | 'rejected' {
    return total >= REVIEW_THRESHOLDS.MIN ? 'human_pending' : 'rejected'
}

/** AI 高置信(仅展示与排序用,不再有发布语义) */
export function isHighConfidence(total: number): boolean {
    return total >= REVIEW_THRESHOLDS.APPROVE
}

/**
 * 执行一次审核。永不 throw(内部自捕获,失败落 review_logs 的 error 报告);
 * 调用方 trigger 接口拿不到本次结果 —— 结果通过 /review/:id/result 轮询。
 */
export async function runReview(questionId: string): Promise<'reviewed' | 'skipped' | 'failed'> {
    if (!llmConfigured()) throw new LlmError('LLM 未配置')
    if (inFlight.has(questionId)) return 'skipped'
    inFlight.add(questionId)
    try {
        const [q] = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1)
        if (!q) return 'skipped'

        const hash = contentHashOf(q)

        // 人工驳回后,内容没改就不许重提 AI —— 逼着先把内容改好
        const [humanReject] = await db
            .select({ contentHash: reviewLogs.contentHash })
            .from(reviewLogs)
            .where(
                and(
                    eq(reviewLogs.questionId, questionId),
                    eq(reviewLogs.source, 'human'),
                    eq(reviewLogs.verdict, 'rejected'),
                ),
            )
            .orderBy(desc(reviewLogs.createdAt))
            .limit(1)
        if (humanReject && humanReject.contentHash === hash) {
            return 'skipped'
        }

        // 幂等:内容没变且已人工通过 → 跳过(不重审不重发布)
        if (q.contentHash === hash && q.status === 'approved') return 'skipped'

        // 先置 pending_review:LLM 挂了也停在这个状态,/review/stale 兜底
        await db
            .update(questions)
            .set({ status: 'pending_review', contentHash: hash })
            .where(eq(questions.id, questionId))

        const userContent = [
            `【题目】${q.title}`,
            `【难度】${q.difficulty}`,
            `【类型】${q.type}`,
            `【标签】${(q.tags ?? []).join('、') || '无'}`,
            '',
            '【题干】',
            q.content,
            '',
            '【参考答案】',
            q.answer,
        ].join('\n')

        let report: AgentReport
        let latencyMs: number
        try {
            // zod 校验失败自动重试一次(plan §2.3)
            ;({ report, latencyMs } = await chatJsonWithRetry(
                [
                    {
                        role: 'system' as const,
                        content: [reviewSystemPrompt, reviewRubricPrompt, reviewOutputPrompt].join('\n\n'),
                    },
                    { role: 'user' as const, content: userContent },
                ],
                agentReportSchema,
                LLM_JSON_RETRY,
            ))
        } catch (err) {
            // LLM 挂了/输出坏:落失败审计,状态停在 pending_review,等 stale 重跑
            await db.insert(reviewLogs).values({
                questionId,
                contentHash: hash,
                verdict: 'pending_review',
                report: { error: err instanceof Error ? err.message : String(err) },
                model: llmConfig().model || null,
            })
            return 'failed'
        }

        const verdict = verdictOf(report.total)

        // slug 策略:agent 给了就用;查重,撞了拼 hash 尾巴;没给保留原值
        let slug: string | undefined
        if (report.slug && report.slug !== q.slug) {
            const [taken] = await db
                .select({ id: questions.id })
                .from(questions)
                .where(and(eq(questions.slug, report.slug), ne(questions.id, questionId)))
                .limit(1)
            slug = taken ? `${report.slug}-${hash.slice(0, 4)}` : report.slug
        }

        // 结果回写 + 审计同事务:日志和状态必须同生共死
        await db.transaction(async (tx) => {
            await tx
                .update(questions)
                .set({
                    status: verdict,
                    reviewScore: report.total,
                    reviewResult: report as unknown as Record<string, unknown>,
                    contentHash: hash,
                    ...(slug ? { slug } : {}),
                    summary: report.summary,
                    ...(report.tags?.length ? { tags: report.tags } : {}),
                })
                .where(eq(questions.id, questionId))
            await tx.insert(reviewLogs).values({
                questionId,
                contentHash: hash,
                verdict,
                score: report.total,
                report: report as unknown as Record<string, unknown>,
                model: llmConfig().model || null,
                latencyMs,
            })
        })

        return 'reviewed'
    } finally {
        inFlight.delete(questionId)
    }
}
