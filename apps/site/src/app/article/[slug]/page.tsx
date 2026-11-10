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

    const series = a.collections?.[0]

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
                <p className="mb-3 font-mono text-[10.5px] tracking-[0.14em] text-muted-foreground">
                    {a.kind === 'own' ? 'ESSAY' : 'CURATED LINK'}
                </p>
                <h1 className="text-balance font-serif text-[32px] leading-tight tracking-[-0.025em] sm:text-[36px]">
                    {a.title}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
                    <span>{a.kind === 'own' ? '原创' : '荐文'}</span>
                    {a.sourceDomain ? <span className="font-mono">{a.sourceDomain}</span> : null}
                    {a.publishedAt ? <span>{a.publishedAt.slice(0, 10)}</span> : null}
                    {series ? (
                        <a
                            href={`/collection/${series.slug}`}
                            className="text-accent underline underline-offset-2 hover:text-seal"
                        >
                            合集《{series.title}》第 {series.index + 1} / {series.total} 篇
                        </a>
                    ) : null}
                </div>
            </div>

            {a.kind === 'curated' && a.externalUrl ? (
                <div className="mt-8 max-w-[62ch]">
                    <p className="m-0 font-serif text-[19px] leading-8 text-foreground/90">
                        {a.comment}
                    </p>
                    <a
                        href={a.externalUrl}
                        rel="nofollow noopener"
                        target="_blank"
                        className="mt-3 inline-flex items-center gap-2 text-[13px] text-accent hover:text-seal"
                    >
                        阅读原文 ↗
                    </a>
                </div>
            ) : null}

            {a.contentMd ? (
                <div className="prose prose-sm mt-6 max-w-none sm:prose-base dark:prose-invert">
                    <Markdown>{a.contentMd}</Markdown>
                </div>
            ) : null}

            {a.kind === 'curated' && a.externalUrl ? (
                <p className="mt-10 border-t border-border pt-4 text-[12px] leading-6 text-muted-foreground">
                    原文来源:
                    <a
                        href={a.externalUrl}
                        rel="nofollow noopener"
                        target="_blank"
                        className="text-accent underline underline-offset-2 hover:text-seal"
                    >
                        {a.sourceDomain ?? a.externalUrl}
                    </a>
                    。本文仅作推荐,版权归原作者所有。
                </p>
            ) : null}

            {series ? (
                <nav className="mt-12 border-t border-foreground/80 pt-5">
                    <p className="mb-3 font-mono text-[10.5px] tracking-[0.14em] text-muted-foreground">
                        合集《{series.title}》· 第 {series.index + 1} / {series.total} 篇
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-4">
                        {series.prevSlug ? (
                            <a
                                href={`/article/${series.prevSlug}`}
                                className="group min-w-0 flex-1 border border-border bg-card px-4 py-3 transition-colors hover:border-accent/60"
                            >
                                <span className="block font-mono text-[10.5px] text-muted-foreground">
                                    ← 上一篇
                                </span>
                                <span className="mt-1 block truncate font-serif text-[14px] transition-colors group-hover:text-accent">
                                    {series.prevTitle}
                                </span>
                            </a>
                        ) : null}
                        {series.nextSlug ? (
                            <a
                                href={`/article/${series.nextSlug}`}
                                className="group min-w-0 flex-1 border border-border bg-card px-4 py-3 text-right transition-colors hover:border-accent/60"
                            >
                                <span className="block font-mono text-[10.5px] text-muted-foreground">
                                    下一篇 →
                                </span>
                                <span className="mt-1 block truncate font-serif text-[14px] transition-colors group-hover:text-accent">
                                    {series.nextTitle}
                                </span>
                            </a>
                        ) : null}
                        <a
                            href={`/collection/${series.slug}`}
                            className="flex flex-none items-center justify-center border border-border px-4 py-3 text-[12px] text-muted-foreground transition-colors hover:border-accent/60 hover:text-accent"
                        >
                            目录
                        </a>
                    </div>
                </nav>
            ) : null}
        </>
    )
}
