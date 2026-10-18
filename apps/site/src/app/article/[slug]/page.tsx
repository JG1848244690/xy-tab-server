import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { siteApi, absoluteUrl } from '@/lib/site-api'
import { renderMarkdownSafe } from '@/lib/markdown'

type Props = { params: Promise<{ slug: string }> }

/** 集合为空时的占位参数(output:export 不允许 gSP 返回空数组) */
const EMPTY_PLACEHOLDER = '_empty'

export const dynamicParams = false

export async function generateStaticParams() {
    const data = await siteApi.sitemapData().catch(() => ({ articles: [] as Array<{ slug: string; updatedAt: string }> }))
    return data.articles.length
        ? data.articles.map((a) => ({ slug: a.slug }))
        : [{ slug: EMPTY_PLACEHOLDER }]
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const a = await siteApi.article(slug).catch(() => null)
    if (!a) return { title: '文章' }
    return {
        title: a.title,
        description: a.excerpt ?? a.comment ?? a.title,
        alternates: { canonical: `/article/${slug}` },
        // curated 是导读卡:canonical 指回本站,外链 nofollow 由站方选择
        openGraph: { url: absoluteUrl(`/article/${slug}`), title: a.title },
    }
}

export default async function ArticlePage({ params }: Props) {
    const { slug } = await params
    if (slug === EMPTY_PLACEHOLDER) {
        return <div className="empty">文章马上就来</div>
    }
    const a = await siteApi.article(slug).catch(() => notFound())

    const articleJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: a.title,
        datePublished: a.publishedAt,
        dateModified: a.updatedAt,
        mainEntityOfPage: absoluteUrl(`/article/${slug}`),
    }

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
            />
            <div className="q-head">
                <h1 className="page-title">{a.title}</h1>
                <div className="meta-row">
                    <span className="pill">{a.kind === 'own' ? '原创' : '荐文'}</span>
                    {a.sourceDomain ? <span className="src">{a.sourceDomain}</span> : null}
                    {a.publishedAt ? <span>{a.publishedAt.slice(0, 10)}</span> : null}
                    <span>{a.viewCount} 次浏览</span>
                </div>
            </div>

            {a.kind === 'curated' && a.externalUrl ? (
                <div className="markdown curated-row">
                    <p>{a.comment}</p>
                    <div className="meta-row">
                        <a
                            href={a.externalUrl}
                            rel="nofollow noopener"
                            target="_blank"
                            style={{ color: 'var(--accent)' }}
                        >
                            阅读原文 ↗
                        </a>
                    </div>
                </div>
            ) : null}

            {a.contentMd ? (
                <div
                    className="markdown"
                    dangerouslySetInnerHTML={{ __html: await renderMarkdownSafe(a.contentMd) }}
                />
            ) : null}
        </>
    )
}
