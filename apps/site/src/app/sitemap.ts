import type { MetadataRoute } from 'next'
import { siteApi, absoluteUrl } from '@/lib/site-api'

// 静态导出要求:构建期生成一次
export const dynamic = 'force-static'

/**
 * sitemap(构建期静态生成)。
 *
 * TODO(>5000 题时):换 generateSitemaps 按 5000 URL/片分片(plan §3.3),
 * 当前量级单文件足够。
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const [data, tags] = await Promise.all([siteApi.sitemapData(), siteApi.tags()])
    const entry = (path: string, updatedAt: string, priority: number) => ({
        url: absoluteUrl(path),
        lastModified: new Date(updatedAt),
        changeFrequency: 'weekly' as const,
        priority,
    })

    return [
        entry('/', data.questions[0]?.updatedAt ?? new Date().toISOString(), 1.0),
        ...data.banks.map((b) => entry(`/bank/${b.slug}`, b.updatedAt, 0.9)),
        // 无 slug 的题(未清洗)没有公开 URL,不进 sitemap
        ...data.questions.filter((q) => q.slug).map((q) => entry(`/question/${q.slug!}`, q.updatedAt, 0.8)),
        ...data.articles.map((a) => entry(`/article/${a.slug}`, a.updatedAt, 0.6)),
        ...data.tags
            .filter((t) => tags.data.some((x) => x.slug === t.slug && x.questionCount > 0))
            .map((t) => entry(`/tag/${t.slug}`, data.questions[0]?.updatedAt ?? new Date().toISOString(), 0.5)),
    ]
}
