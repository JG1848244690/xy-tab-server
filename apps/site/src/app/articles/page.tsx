import type { Metadata } from 'next'
import { ListRow } from '@/components/rows'
import { siteApi } from '@/lib/site-api'

export const metadata: Metadata = {
    title: '文章',
    description: '原创面试经验图文与每周精选外链导读。',
    alternates: { canonical: '/articles' },
}

export default async function ArticlesPage() {
    const [own, curated] = await Promise.all([
        siteApi.articles({ kind: 'own', size: 50 }),
        siteApi.articles({ kind: 'curated', size: 20 }),
    ])

    return (
        <>
            <h1 className="text-balance text-[26px] font-bold tracking-[-0.022em]">文章</h1>
            <p className="mt-2 mb-7 text-[15px] text-muted-foreground">原创图文与每周荐文导读。</p>

            <div className="mt-8 mb-2 flex items-baseline justify-between">
                <h2 className="text-base font-semibold tracking-[-0.01em]">原创图文</h2>
            </div>
            {own.data.length ? (
                <div className="border-t border-border">
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
                <div className="rounded-xl border border-dashed border-border bg-muted p-14 text-center text-sm text-muted-foreground">
                    原创文章马上就来
                </div>
            )}

            <div className="mt-8 mb-2 flex items-baseline justify-between">
                <h2 className="text-base font-semibold tracking-[-0.01em]">本周荐文</h2>
                <a href="/digest" className="text-[13px] text-accent">往期荟萃 →</a>
            </div>
            {curated.data.slice(0, 5).map((a) => (
                <a
                    key={a.slug}
                    href={`/article/${a.slug}`}
                    className="-mx-2 block rounded-lg border-b border-border border-l-2 border-l-accent px-2 py-4 transition-colors hover:bg-card"
                >
                    <h3 className="m-0 text-[15.5px] font-semibold leading-snug">{a.title}</h3>
                    <p className="mt-1 text-[13.5px] text-muted-foreground">{a.comment ?? a.excerpt}</p>
                    <div className="mt-1.5 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                        {a.sourceDomain ? <span>{a.sourceDomain}</span> : null}
                    </div>
                </a>
            ))}
            {curated.data.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted p-14 text-center text-sm text-muted-foreground">
                    荐文征集ing
                </div>
            ) : null}
        </>
    )
}
