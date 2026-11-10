import type { Metadata } from 'next'
import { ListRow } from '@/components/rows'
import { siteApi, type CollectionListItem } from '@/lib/site-api'

export const metadata: Metadata = {
    title: '文章',
    description: '原创面试经验图文与每周精选外链导读。',
    alternates: { canonical: '/articles' },
}

export default async function ArticlesPage() {
    const [own, curated, collections] = await Promise.all([
        siteApi.articles({ kind: 'own', size: 50 }),
        siteApi.articles({ kind: 'curated', size: 20 }),
        // 兼容旧 API:合集接口没上线时降级成空
        siteApi.collections().catch(() => ({ data: [] as CollectionListItem[] })),
    ])

    return (
        <>
            <h1 className="text-balance font-serif text-[32px] leading-tight tracking-[-0.025em]">
                文章
            </h1>
            <p className="mt-2 mb-10 text-[14px] text-muted-foreground">原创图文与每周荐文导读。</p>

            {collections.data.length ? (
                <>
                    <div className="mb-2 flex items-baseline justify-between border-b border-foreground/80 pb-2">
                        <h2 className="font-serif text-[15px] tracking-[0.04em]">合集</h2>
                        <a
                            href="/collections"
                            className="text-[12px] text-muted-foreground transition-colors hover:text-accent"
                        >
                            全部合集 →
                        </a>
                    </div>
                    <div className="mb-12">
                        {collections.data.map((c) => (
                            <a
                                key={c.slug}
                                href={`/collection/${c.slug}`}
                                className="group flex items-baseline gap-4 border-b border-border py-3"
                            >
                                <span className="min-w-0 flex-1 font-serif text-[16.5px] leading-snug transition-colors group-hover:text-accent">
                                    {c.title}
                                </span>
                                {c.description ? (
                                    <span className="hidden min-w-0 max-w-[46ch] truncate text-[12px] text-muted-foreground sm:block">
                                        {c.description}
                                    </span>
                                ) : null}
                                <span className="flex-none font-mono text-[10.5px] text-muted-foreground">
                                    {c.articleCount} 篇
                                </span>
                            </a>
                        ))}
                    </div>
                </>
            ) : null}

            <div className="mb-2 flex items-baseline justify-between border-b border-foreground/80 pb-2">
                <h2 className="font-serif text-[15px] tracking-[0.04em]">原创图文</h2>
            </div>
            {own.data.length ? (
                <div className="border-t border-transparent">
                    {own.data.map((a) => (
                        <ListRow
                            key={a.slug}
                            href={`/article/${a.slug}`}
                            title={a.title}
                            desc={a.excerpt}
                            meta={
                                <>
                                    {a.publishedAt ? <span>{a.publishedAt.slice(0, 10)}</span> : null}
                                </>
                            }
                        />
                    ))}
                </div>
            ) : (
                <div className="border-y border-dashed border-border py-14 text-center text-sm text-muted-foreground">
                    原创文章马上就来
                </div>
            )}

            <div className="mb-2 mt-12 flex items-baseline justify-between border-b border-foreground/80 pb-2">
                <h2 className="font-serif text-[15px] tracking-[0.04em]">本周荐文</h2>
                <a href="/digest" className="text-[12px] text-muted-foreground transition-colors hover:text-accent">
                    往期荟萃 →
                </a>
            </div>
            {curated.data.slice(0, 5).map((a) => (
                <a
                    key={a.slug}
                    href={`/article/${a.slug}`}
                    className="group -mx-3 block border-b border-border px-3 py-4 transition-colors hover:bg-card/70"
                >
                    <h3 className="m-0 font-serif text-[17px] leading-snug transition-colors group-hover:text-accent">
                        {a.title}
                    </h3>
                    <p className="mt-1 text-[12.5px] leading-5 text-muted-foreground">
                        {a.comment ?? a.excerpt}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 font-mono text-[10.5px] text-muted-foreground">
                        {a.sourceDomain ? <span>{a.sourceDomain}</span> : null}
                    </div>
                </a>
            ))}
            {curated.data.length === 0 ? (
                <div className="border-y border-dashed border-border py-14 text-center text-sm text-muted-foreground">
                    荐文征集ing
                </div>
            ) : null}
        </>
    )
}
