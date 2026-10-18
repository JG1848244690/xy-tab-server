/**
 * agent.ts —— 审核执行体(面试站 P0,plan §2.3)
 *
 * 设计:
 *  - 进程内异步,不引入队列中间件(1.6G 小服务器没预算);
 *    inFlight Set 去重并发触发,进程重启丢队列由 /review/stale 兜底重跑
 *  - contentHash 幂等:题目没改就不重审(省 token,防重复发布动作)
 *  - 触发即置 pending_review;LLM 挂了留在该状态并落失败日志,不阻塞别人
 *  - 结果落 review_logs(审计)+ 回写 questions(状态/评分/报告/摘要/slug/tags)
 */
import { createHash } from 'node:crypto'
import { and, eq, ne } from 'drizzle-orm'
import env from '../../env.js'
import db from '../../db/index.js'
import { questions, reviewLogs } from '../../db/schema.js'
import { LLM_JSON_RETRY, REVIEW_THRESHOLDS } from '../../lib/constants.js'
import { LlmError, agentReportSchema, chatJsonWithRetry, llmConfigured } from './llm.js'
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

/** 阈值判定:≥85 自动发布;60-84 待人审;<60 拒绝(常量表,见 lib/constants.ts) */
export function verdictOf(total: number): 'approved' | 'pending_review' | 'rejected' {
    if (total >= REVIEW_THRESHOLDS.APPROVE) return 'approved'
    if (total >= REVIEW_THRESHOLDS.MIN) return 'pending_review'
    return 'rejected'
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
        // 幂等:内容没变且已过审 → 跳过(不重审不重发布)
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
                model: env.LLM_MODEL || null,
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
                model: env.LLM_MODEL || null,
                latencyMs,
            })
        })

        return 'reviewed'
    } finally {
        inFlight.delete(questionId)
    }
}
