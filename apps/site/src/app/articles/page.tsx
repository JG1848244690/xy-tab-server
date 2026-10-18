import type { Metadata } from 'next'
import Link from 'next/link'
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

            <div className="section-head">
                <h2>原创图文</h2>
            </div>
            {own.data.length ? (
                own.data.map((a) => (
                    <Link key={a.slug} href={`/article/${a.slug}`} className="card" style={{ display: 'block' }}>
                        <h3>{a.title}</h3>
                        <p>{a.excerpt}</p>
                        <div className="meta-row">
                            {a.publishedAt ? <span>{a.publishedAt.slice(0, 10)}</span> : null}
                            <span>{a.viewCount} 次浏览</span>
                        </div>
                    </Link>
                ))
            ) : (
                <div className="empty">原创文章马上就来</div>
            )}

            <div className="section-head">
                <h2>本周荐文</h2>
                <Link href="/digest">往期荟萃 →</Link>
            </div>
            {curated.data.slice(0, 5).map((a) => (
                <a
                    key={a.slug}
                    href={`/article/${a.slug}`}
                    className="card curated-card"
                    style={{ display: 'block' }}
                >
                    <h3>{a.title}</h3>
                    <p>{a.comment ?? a.excerpt}</p>
                    <div className="meta-row">
                        {a.sourceDomain ? <span className="pill">{a.sourceDomain}</span> : null}
                    </div>
                </a>
            ))}
            {curated.data.length === 0 ? <div className="empty">荐文征集ing</div> : null}
        </>
    )
}
