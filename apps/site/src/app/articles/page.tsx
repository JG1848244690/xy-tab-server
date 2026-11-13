import type { Metadata } from 'next'
import { siteApi, type CollectionListItem } from '@/lib/site-api'
import { ArticlesTabs } from '@/components/articles-tabs'

export const metadata: Metadata = {
    title: '文章',
    description: '原创图文、每周荐文与主题合集:一个页面切换,不用往下翻。',
    alternates: { canonical: '/articles' },
}

export default async function ArticlesPage() {
    const [own, curated, collections] = await Promise.all([
        siteApi.articles({ kind: 'own', size: 50 }),
        siteApi.articles({ kind: 'curated', size: 50 }),
        // 兼容旧 API:合集接口没上线时降级成空
        siteApi.collections().catch(() => ({ data: [] as CollectionListItem[] })),
    ])

    return (
        <>
            <h1 className="text-balance font-serif text-[32px] leading-tight tracking-[-0.025em]">
                文章
            </h1>
            <p className="mt-2 text-[14px] text-muted-foreground">
                原创、荐文、合集分三个页签,数量写在标签上。
            </p>

            <ArticlesTabs
                own={own.data}
                curated={curated.data}
                collections={collections.data}
            />
        </>
    )
}
