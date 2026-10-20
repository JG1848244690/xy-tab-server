import { createMessageObjectSchema, HttpStatusPhrases } from './openapi.js'

export const notFoundSchema = createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND)

/** 业务常量。阈值"走 env/常量表"里的常量表这一半;
 * 需要运行时可调时再升到 env(现在没必要多三个配置项)。 */

/**
 * AI 审核阈值(2026-10-20 修订)
 *
 * 流程改为「人工审核强制,AI 只做前置筛选」:
 *   - MIN(60) 以下 → AI 打回(rejected),记录报告,创建者改内容后可重提
 *   - MIN(60) 以上 → human_pending,进人工审核队列(AI 的分数只是参考)
 *   - APPROVE(85) 不再有发布语义,仅作为「AI 高置信」的展示/排序指标
 */
export const REVIEW_THRESHOLDS = {
    /** 低于此分:AI 打回 */
    MIN: 60,
    /** 高于此分:标记为 AI 高置信(队列里排前面),但不自动发布 */
    APPROVE: 85,
} as const

/** LLM 单次调用超时(毫秒)。agent 挂了要快速失败,不能挂着拖死进程 */
export const LLM_TIMEOUT_MS = 30_000

/** zod 校验失败后的重试次数(共调用 1 + RETRY 次) */
export const LLM_JSON_RETRY = 1

/** /review/batch 单次最多触发多少题 */
export const REVIEW_BATCH_MAX = 20

/** pending_review 超过这么多分钟没出结果视为卡死,/review/stale 兜底重跑 */
export const REVIEW_STALE_MINUTES = 30
