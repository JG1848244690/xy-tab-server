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
import { LlmError, agentReportSchema, chatJson, chatJsonWithRetry, llmConfigured, llmConfig, revisionSchema } from './llm.js'
import type { AgentReport } from './llm.js'
import { reviewSystemPrompt } from './prompts/system.js'
import { reviewRubricPrompt } from './prompts/rubric.js'
import { reviewOutputPrompt } from './prompts/output.js'
import { revisionSystemPrompt } from './prompts/revision.js'
import { normalizeTags, existingTags } from './tags.js'

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

        // 是否存量已发布(清洗场景:全程保持 approved,只补元数据)
        const wasApproved = q.status === 'approved'

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

        // 先置 pending_review:LLM 挂了也停在这个状态,/review/stale 兜底。
        // 例外:已 approved 的存量题(清洗场景)全程保持 approved,
        // 不给公开站制造"消失的题目"
        await db
            .update(questions)
            .set({
                status: wasApproved ? 'approved' : 'pending_review',
                contentHash: hash,
            })
            .where(eq(questions.id, questionId))

        // 标签候选词表(registry + 已过审题目);尽量复用,别每题造新词
        const vocabulary = await existingTags()
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
            '',
            '【平台已有标签(优先复用,避免自造小众标签)】',
            vocabulary.join('、') || '无',
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

        // 模型用空串表示"不需要改进":归一成没有 revised,避免后台展示空改进版
        if (report.revised && !(report.revised.content.trim() && report.revised.answer.trim())) {
            const { revised: _drop, ...rest } = report
            report = rest
        }

        // 标签收敛:别名归一 + 忽略大小写去重 + 最多 4 个,且最多新增 1 个;
        // 归一后的结果同时写回报告,保证「已通过」列表与题目标签一致
        const tags = normalizeTags(report.tags, { vocabulary, maxNew: 1 })
        if (tags.length) report = { ...report, tags }

        // 兜底:AI 打回但主报告漏了改进版(模型偶发不守契约)→ 单独再生成一次。
        // 只影响"能不能一键应用",失败也不改变打回结论。
        if (!report.revised && verdict === 'rejected') {
            try {
                const revisionContent = [
                    userContent,
                    '',
                    '【AI 审核意见】',
                    report.summary,
                    ...(report.suggestions ?? []).map((s) => `- ${s}`),
                ].join('\n')
                const { report: revised } = await chatJson(
                    [
                        { role: 'system' as const, content: revisionSystemPrompt },
                        { role: 'user' as const, content: revisionContent },
                    ],
                    revisionSchema,
                )
                report = { ...report, revised: revised.revised }
            } catch {
                // 改进版是增强项:生成失败照常打回,不阻塞状态流转
            }
        }

        // 存量清洗语义:已是 approved 的题(公开在站上)不因 AI 重审而降级 ——
        // AI 只补元数据(slug/summary/分数);低分也保持 approved,仅落一条
        // 打回建议的日志供人工参考(删它的决定必须由人做)
        const finalStatus = wasApproved ? 'approved' : verdict

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
                    status: finalStatus,
                    reviewScore: report.total,
                    reviewResult: report as unknown as Record<string, unknown>,
                    contentHash: hash,
                    ...(slug ? { slug } : {}),
                    summary: report.summary,
                    ...(tags.length ? { tags } : {}),
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
