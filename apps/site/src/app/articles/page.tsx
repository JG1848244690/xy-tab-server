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
            <h1 className="page-title">文章</h1>
            <p className="page-sub">原创图文与每周荐文导读。</p>

            <div className="section-head">
                <h2>原创图文</h2>
            </div>
            {own.data.length ? (
                <div className="list">
                    {own.data.map((a) => (
                        <ListRow
                            key={a.slug}
                            href={`/article/${a.slug}`}
                            title={a.title}
                            desc={a.excerpt}
                            meta={
                                <>
                                    {a.publishedAt ? <span>{a.publishedAt.slice(0, 10)}</span> : null}
                                    <span>{a.viewCount} 次浏览</span>
                                </>
                            }
                        />
                    ))}
                </div>
            ) : (
                <div className="empty">原创文章马上就来</div>
            )}

            <div className="section-head">
                <h2>本周荐文</h2>
                <a href="/digest">往期荟萃 →</a>
            </div>
            {curated.data.slice(0, 5).map((a) => (
                <a key={a.slug} href={`/article/${a.slug}`} className="row curated-row">
                    <h3>
                        <span className="row-title">{a.title}</span>
                    </h3>
                    <p>{a.comment ?? a.excerpt}</p>
                    <div className="meta-row">
                        {a.sourceDomain ? <span className="src">{a.sourceDomain}</span> : null}
                    </div>
                </a>
            ))}
            {curated.data.length === 0 ? <div className="empty">荐文征集ing</div> : null}
        </>
    )
}
