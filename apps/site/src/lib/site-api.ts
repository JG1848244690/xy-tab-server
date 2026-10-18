/**
 * 构建期数据获取(面试站 SSG)。
 *
 * 所有页面在 next build 时把数据拉死进 HTML;运行时没有 Node、没有服务端
 * fetch。拉取失败直接 fail build —— 宁可部署失败也不上线半残的静态站。
 *
 * API 地址:SITE_API_BASE(默认线上 https://hls.kskbl.com.cn/api-hls),
 * CI 可覆盖(例如绕过 CF 直连源站加速构建)。
 */
export const API_BASE = process.env.SITE_API_BASE ?? 'https://hls.kskbl.com.cn/api-hls'

async function get<T>(path: string): Promise<T> {
    // 重试 + 30s 超时:构建期要打几十上百个请求,链路(尤其过 CF)偶发抖动
    // 一次就失败会让整个 build 挂掉;3 次退避重试,还不行才 fail build
    let lastError: unknown
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await fetch(`${API_BASE}${path}`, {
                // 构建期数据:next 缓存语义在 export 下要 force-cache
                // (no-store 在 force-static 收集期会被拒)
                cache: 'force-cache',
                signal: AbortSignal.timeout(30_000),
            })
            if (!res.ok) {
                throw new Error(`[site build] GET ${path} -> ${res.status}`)
            }
            return (await res.json()) as T
        } catch (err) {
            lastError = err
            if (attempt < 2) {
                await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
            }
        }
    }
    throw lastError
}

export type SitemapData = {
    questions: Array<{ slug: string; updatedAt: string }>
    banks: Array<{ slug: string; updatedAt: string }>
    articles: Array<{ slug: string; updatedAt: string }>
    tags: Array<{ slug: string }>
}

export type QuestionListItem = {
    slug: string
    title: string
    summary: string | null
    type: 'markdown' | 'text'
    difficulty: 'easy' | 'medium' | 'hard'
    tags: string[] | null
    viewCount: number
    publishedAt: string | null
    updatedAt: string
    bankSlug: string | null
}

export type QuestionDetail = QuestionListItem & {
    content: string
    answer: string
}

export type BankListItem = {
    slug: string
    title: string
    description: string | null
    cover: string | null
    tags: string[] | null
    updatedAt: string
    questionCount: number
}

export type BankDetail = BankListItem & {
    questions: QuestionListItem[]
}

export type TagItem = {
    slug: string
    name: string
    description: string | null
    hasIntro: boolean
    questionCount: number
}

export type ArticleListItem = {
    slug: string
    title: string
    kind: 'own' | 'curated'
    excerpt: string | null
    comment: string | null
    externalUrl: string | null
    sourceDomain: string | null
    tags: string[] | null
    publishedAt: string | null
    viewCount: number
    updatedAt: string
}

export type ArticleDetail = ArticleListItem & {
    contentMd: string | null
    comment: string | null
    relatedQuestionSlugs: string[]
}

export const siteApi = {
    sitemapData: () => get<SitemapData>('/public/sitemap-data'),
    questions: (query: { bank?: string; tag?: string; page?: number; size?: number } = {}) => {
        const p = new URLSearchParams(
            Object.entries(query)
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => [k, String(v)]),
        ).toString()
        return get<{ data: QuestionListItem[]; total: number }>(`/public/questions?${p}`)
    },
    question: (slug: string) => get<QuestionDetail>(`/public/questions/${slug}`),
    banks: () => get<{ data: BankListItem[] }>('/public/banks'),
    bank: (slug: string) => get<BankDetail>(`/public/banks/${slug}`),
    tags: () => get<{ data: TagItem[] }>('/public/tags'),
    articles: (query: { kind?: 'own' | 'curated'; page?: number; size?: number } = {}) => {
        const p = new URLSearchParams(
            Object.entries(query)
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => [k, String(v)]),
        ).toString()
        return get<{ data: ArticleListItem[]; total: number }>(`/public/articles?${p}`)
    },
    article: (slug: string) => get<ArticleDetail>(`/public/articles/${slug}`),
}

/** 站点自身 URL(canonical/OG/sitemap 用),部署域名定了以后配 env */
export const SITE_URL = (
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tiku.kskbl.com.cn'
).replace(/\/$/, '')

export const SITE_NAME = 'HLS 面试题库'

export function absoluteUrl(path: string): string {
    return `${SITE_URL}${path}`
}
