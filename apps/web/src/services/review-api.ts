import { request } from '@/lib/request'

/**
 * 审核工作台 API(docs/review-workflow-plan.md §4)
 * 全部接口 admin-only(后端 requireAdmin/adminOnly 强校验)
 */

export interface ReviewQueueItem {
    id: string
    title: string
    slug: string | null
    status: string
    /** AI 总分 0-100 */
    reviewScore: number | null
    /** 完整 AI 报告:五维 + 建议 + 口诀 */
    reviewResult: {
        dimensions?: Record<string, number>
        total?: number
        summary?: string
        suggestions?: string[]
        oneLiner?: string
        mnemonic?: string
        error?: string
    } | null
    updatedAt: string
    latestLog: {
        verdict: string
        score: number | null
        source: string
        note: string | null
        createdAt: string
    } | null
}

export const reviewApi = {
    /** 人工审核队列:pending = AI 过了等人审;rejected = 被 AI 打回 */
    queue: (tab: 'pending' | 'rejected', page = 1, size = 20) =>
        request
            .get<{ data: ReviewQueueItem[]; total: number; page: number; size: number }>(
                '/review/queue',
                { params: { tab, page, size } },
            )
            .then((r) => r.data),

    /** 人工裁决:approve = 通过并发布;reject = 驳回(note 必填,后端强校验) */
    human: (id: string, decision: 'approve' | 'reject', note?: string) =>
        request
            .post<{ success: boolean; status: string; publishedAt: string | null }>(
                `/review/${id}/human`,
                { decision, note },
            )
            .then((r) => r.data),

    /** 单题审核结果轮询 */
    result: (id: string) =>
        request
            .get<{
                question: {
                    id: string
                    title: string
                    status: string
                    reviewScore: number | null
                    reviewResult: ReviewQueueItem['reviewResult']
                    contentHash: string | null
                } | null
                lastLog: ReviewQueueItem['latestLog']
            }>(`/review/${id}/result`)
            .then((r) => r.data),
}
