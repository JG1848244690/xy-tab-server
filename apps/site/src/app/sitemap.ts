import type { MetadataRoute } from 'next'
import { siteApi, absoluteUrl } from '@/lib/site-api'
import { projectNotes } from '@/lib/projects'
import { wallpaperGuides, wallpaperGuidePath } from '@/lib/wallpaper-guides'

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
    const entry = (path: string, updatedAt?: string) => ({
        url: absoluteUrl(path),
        ...(updatedAt ? { lastModified: new Date(updatedAt) } : {}),
    })

    return [
        ...['/', '/banks', '/articles', '/collections', '/tags', '/projects'].map((path) => entry(path)),
        ...projectNotes.map((note) => ({ url: absoluteUrl(`/projects/notes/${note.slug}`) })),
        { url: absoluteUrl('/en/projects/newtab') },
        ...wallpaperGuides.flatMap(({ slug }) => (['zh', 'en'] as const).map((language) => ({
            url: absoluteUrl(wallpaperGuidePath(slug, language)),
        }))),
        ...data.banks.map((b) => entry(`/bank/${b.slug}`, b.updatedAt)),
        // 无 slug 的题(未清洗)没有公开 URL,不进 sitemap
        ...data.questions.filter((q) => q.slug).map((q) => entry(`/question/${q.slug!}`, q.updatedAt)),
        ...data.articles.map((a) => entry(`/article/${a.slug}`, a.updatedAt)),
        ...(data.collections ?? []).map((c) => entry(`/collection/${c.slug}`, c.updatedAt)),
        ...tags.data
            .filter((tag) => tag.questionCount > 0 && tag.kind !== 'legacy' && tag.hasIntro)
            .map((tag) => entry(`/tag/${tag.slug}`)),
    ]
}
