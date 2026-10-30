import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Markdown } from '@/lib/markdown'
import { siteApi, absoluteUrl } from '@/lib/site-api'

type Props = { params: Promise<{ slug: string }> }

const EMPTY_PLACEHOLDER = '_empty'

export const dynamicParams = false

export async function generateStaticParams() {
    const data = await siteApi
        .sitemapData()
        .catch(() => ({ articles: [] as Array<{ slug: string; updatedAt: string }> }))
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
        openGraph: { url: absoluteUrl(`/article/${slug}`), title: a.title },
    }
}

export default async function ArticlePage({ params }: Props) {
    const { slug } = await params
    if (slug === EMPTY_PLACEHOLDER) {
        return <div className="rounded-xl border border-dashed border-border bg-muted p-14 text-center text-sm text-muted-foreground">文章马上就来</div>
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
            <div className="border-b border-border pb-5">
                <h1 className="text-balance font-serif text-[32px] leading-tight tracking-[-0.025em]">
                    {a.title}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[12.5px] text-muted-foreground">
                    <span className="rounded-full border border-border px-2.5 py-0.5">
                        {a.kind === 'own' ? '原创' : '荐文'}
                    </span>
                    {a.sourceDomain ? <span className="font-mono text-xs">{a.sourceDomain}</span> : null}
                    {a.publishedAt ? <span>{a.publishedAt.slice(0, 10)}</span> : null}
                </div>
            </div>

            {a.kind === 'curated' && a.externalUrl ? (
                <div className="mt-6 rounded-xl border border-border border-l-2 border-l-accent bg-card p-5">
                    <p className="m-0 text-[14.5px] text-foreground/90">{a.comment}</p>
                    <div className="mt-2 text-[13px]">
                        <a
                            href={a.externalUrl}
                            rel="nofollow noopener"
                            target="_blank"
                            className="text-accent underline underline-offset-[3px]"
                        >
                            阅读原文 ↗
                        </a>
                    </div>
                </div>
            ) : null}

            {a.contentMd ? (
                <div className="prose prose-sm mt-6 max-w-none sm:prose-base dark:prose-invert">
                    <Markdown>{a.contentMd}</Markdown>
                </div>
            ) : null}
        </>
    )
}
