import { request } from '@/lib/request'

/**
 * 审核中心 API(docs/review-workflow-plan.md §4)
 * 队列接口 admin-only(后端 adminOnly 强校验);触发/应用修订允许 owner + admin
 */

/** 审核队列筛选(单列表 + 状态筛选,2026-10-26 起替代四个 tab) */
export type ReviewQueueFilter = 'all' | 'reviewing' | 'pending' | 'rejected' | 'approved'

export interface ReviewQueueCounts {
    all: number
    reviewing: number
    pending: number
    rejected: number
    approved: number
}

/** AI 打回时给出的改进版(可直接落库,2026-10-26) */
export interface RevisedQuestion {
    title?: string
    content: string
    answer: string
    tags?: string[]
}

/** AI 自动出题的结果(未落库,前端可编辑后再创建) */
export interface GeneratedQuestion {
    title: string
    content: string
    answer: string
    tags: string[]
    difficulty: 'easy' | 'medium' | 'hard'
    type: 'markdown' | 'text'
}

export interface ReviewQueueItem {
    id: string
    title: string
    slug: string | null
    status: string
    /** AI 总分 0-100 */
    reviewScore: number | null
    /** 完整 AI 报告:五维 + 建议 + 口诀 + 改进版 */
    reviewResult: {
        dimensions?: Record<string, number>
        total?: number
        summary?: string
        suggestions?: string[]
        oneLiner?: string
        mnemonic?: string
        revised?: RevisedQuestion
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
    /** 审核队列:单列表 + 状态筛选 */
    queue: (status: ReviewQueueFilter, page = 1, size = 20) =>
        request
            .get<{
                data: ReviewQueueItem[]
                total: number
                page: number
                size: number
                counts: ReviewQueueCounts
            }>('/review/queue', { params: { status, page, size } })
            .then((r) => r.data),

    /** 人工裁决:approve = 通过并发布;reject = 驳回(note 必填,后端强校验) */
    human: (id: string, decision: 'approve' | 'reject', note?: string) =>
        request
            .post<{ success: boolean; status: string; publishedAt: string | null }>(
                `/review/${id}/human`,
                { decision, note },
            )
            .then((r) => r.data),

    /** 在原题上重新触发 AI 审核(内容没改时后端可能返回 skipped) */
    trigger: (id: string) =>
        request
            .post<{
                status: 'pending_review' | 'skipped'
                quota?: { used: number; limit: number; remaining: number }
            }>(`/review/${id}`)
            .then((r) => r.data),

    /** 一键应用 AI 改进版并自动重审(写回原题,不新建) */
    applyRevision: (id: string) =>
        request
            .post<{
                applied: boolean
                status: string
                queued: boolean
                quota?: { used: number; limit: number; remaining: number }
            }>(`/review/${id}/apply-revision`)
            .then((r) => r.data),

    /** AI 自动出题:粘贴知识点/文档/AI 回答 → 生成完整题目(不落库) */
    generate: (body: {
        source: string
        type?: 'markdown' | 'text'
        difficulty?: 'easy' | 'medium' | 'hard'
    }) =>
        request
            .post<{
                question: GeneratedQuestion
                quota?: { used: number; limit: number; remaining: number }
            }>('/review/generate', body)
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
