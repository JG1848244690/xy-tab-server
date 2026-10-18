import { createMessageObjectSchema, HttpStatusPhrases } from './openapi.js'

export const notFoundSchema = createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND)

/** 业务常量。阈值"走 env/常量表"里的常量表这一半;
 * 需要运行时可调时再升到 env(现在没必要多三个配置项)。 */

/** AI 审核阈值:总分 ≥ APPROVE 自动发布;[MIN, APPROVE) 待人审;< MIN 拒绝 */
export const REVIEW_THRESHOLDS = {
    APPROVE: 85,
    MIN: 60,
} as const

/** LLM 单次调用超时(毫秒)。agent 挂了要快速失败,不能挂着拖死进程 */
export const LLM_TIMEOUT_MS = 30_000

/** zod 校验失败后的重试次数(共调用 1 + RETRY 次) */
export const LLM_JSON_RETRY = 1

/** /review/batch 单次最多触发多少题 */
export const REVIEW_BATCH_MAX = 20

/** pending_review 超过这么多分钟没出结果视为卡死,/review/stale 兜底重跑 */
export const REVIEW_STALE_MINUTES = 30
