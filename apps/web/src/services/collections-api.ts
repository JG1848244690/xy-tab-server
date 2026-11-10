import { request } from '@/lib/request'

export type CollectionStatus = 'draft' | 'approved'

export interface Collection {
    id: string
    slug: string
    title: string
    description: string | null
    cover: string | null
    sort: number
    status: CollectionStatus
    createdAt: string
    updatedAt: string
}

export interface CollectionListItem extends Collection {
    articleCount: number
}

export interface CollectionArticleRef {
    id: string
    slug: string
    title: string
    kind: 'own' | 'curated'
    status: string
    publishedAt: string | null
    sort: number
}

export interface CollectionInput {
    title: string
    slug?: string
    description?: string
    cover?: string
    sort?: number
    status: CollectionStatus
}

export interface CollectionListParams {
    status?: CollectionStatus
    q?: string
    page?: number
    size?: number
}

export const collectionsApi = {
    list: async (params: CollectionListParams = {}) => {
        const res = await request.get<{
            data: CollectionListItem[]
            total: number
            page: number
            size: number
        }>('/collections', { params })
        return res.data
    },
    get: async (id: string) => {
        const res = await request.get<{
            collection: Collection
            articles: CollectionArticleRef[]
        }>(`/collections/${id}`)
        return res.data
    },
    create: async (input: CollectionInput) => {
        const res = await request.post<Collection>('/collections', input)
        return res.data
    },
    update: async (id: string, input: Partial<CollectionInput>) => {
        const res = await request.patch<Collection>(`/collections/${id}`, input)
        return res.data
    },
    remove: async (id: string) => {
        await request.delete(`/collections/${id}`)
    },
    setArticles: async (id: string, articleIds: string[]) => {
        const res = await request.put<{ ok: boolean; count: number }>(
            `/collections/${id}/articles`,
            { articleIds },
        )
        return res.data
    },
}
