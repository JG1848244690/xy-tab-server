import { request } from '@/lib/request'

export type ArticleKind = 'own' | 'curated'
export type ArticleStatus = 'draft' | 'pending_review' | 'approved' | 'rejected'

export interface Article {
    id: string
    slug: string
    title: string
    cover: string | null
    kind: ArticleKind
    contentMd: string | null
    externalUrl: string | null
    sourceDomain: string | null
    comment: string | null
    excerpt: string | null
    relatedQuestionIds: string[] | null
    tags: string[] | null
    status: ArticleStatus
    publishedAt: string | null
    viewCount: number
    createdAt: string
    updatedAt: string
}

export interface ArticleInput {
    kind: ArticleKind
    title?: string
    slug?: string
    excerpt?: string
    contentMd?: string
    externalUrl?: string
    comment?: string
    tags?: string[]
    status: 'draft' | 'approved'
}

export interface ArticleListParams {
    kind?: ArticleKind
    status?: ArticleStatus
    q?: string
    page?: number
    size?: number
}

export const articlesApi = {
    list: async (params: ArticleListParams = {}) => {
        const res = await request.get<{ data: Article[]; total: number; page: number; size: number }>(
            '/articles',
            { params },
        )
        return res.data
    },
    create: async (input: ArticleInput) => {
        const res = await request.post<Article>('/articles', input)
        return res.data
    },
    update: async (id: string, input: Partial<ArticleInput>) => {
        const res = await request.patch<Article>(`/articles/${id}`, input)
        return res.data
    },
    remove: async (id: string) => {
        await request.delete(`/articles/${id}`)
    },
}
