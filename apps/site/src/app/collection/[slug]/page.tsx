import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { siteApi, absoluteUrl } from '@/lib/site-api'

type Props = { params: Promise<{ slug: string }> }

const EMPTY_PLACEHOLDER = '_empty'

export const dynamicParams = false

export async function generateStaticParams() {
    const data = await siteApi
        .sitemapData()
        .catch(() => ({ collections: [] as Array<{ slug: string; updatedAt: string }> }))
    const list = data.collections ?? []
    return list.length ? list.map((c) => ({ slug: c.slug })) : [{ slug: EMPTY_PLACEHOLDER }]
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    if (slug === EMPTY_PLACEHOLDER) return { title: '合集' }
    const c = await siteApi.collection(slug).catch(() => null)
    if (!c) return { title: '合集' }
    return {
        title: c.title,
        description: c.description ?? `${c.title}:共 ${c.articleCount} 篇,按顺序读。`,
        alternates: { canonical: `/collection/${slug}` },
        openGraph: { url: absoluteUrl(`/collection/${slug}`), title: c.title },
    }
}

export default async function CollectionPage({ params }: Props) {
    const { slug } = await params
    if (slug === EMPTY_PLACEHOLDER) {
        return (
            <div className="rounded-xl border border-dashed border-border bg-muted p-14 text-center text-sm text-muted-foreground">
                合集马上就来
            </div>
        )
    }

    const c = await siteApi.collection(slug).catch(() => notFound())

    return (
        <>
            <div className="border-b border-border pb-6">
                <p className="mb-3 font-mono text-[10.5px] tracking-[0.14em] text-muted-foreground">
                    COLLECTION · {c.articleCount} 篇
                </p>
                <h1 className="text-balance font-serif text-[32px] leading-tight tracking-[-0.025em] sm:text-[36px]">
                    {c.title}
                </h1>
                {c.description ? (
                    <p className="mt-3 max-w-[62ch] text-[14px] leading-7 text-muted-foreground">
                        {c.description}
                    </p>
                ) : null}
            </div>

            <ol className="mt-8 border-t border-foreground/80">
                {c.articles.map((a, i) => (
                    <li key={a.slug} className="border-b border-border">
                        <a href={`/article/${a.slug}`} className="group flex items-baseline gap-4 py-4">
                            <span className="w-7 flex-none font-mono text-[11px] text-muted-foreground">
                                {String(i + 1).padStart(2, '0')}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="font-serif text-[17px] leading-snug transition-colors group-hover:text-accent">
                                    {a.title}
                                </span>
                                {a.excerpt || a.comment ? (
                                    <span className="mt-1 block text-[12.5px] leading-5 text-muted-foreground">
                                        {a.excerpt ?? a.comment}
                                    </span>
                                ) : null}
                            </span>
                            <span className="flex-none font-mono text-[10.5px] text-muted-foreground">
                                {a.publishedAt ? a.publishedAt.slice(0, 10) : ''}
                            </span>
                        </a>
                    </li>
                ))}
            </ol>

            <p className="mt-10 border-t border-border pt-4 text-[12px] leading-6 text-muted-foreground">
                返回
                <a href="/collections" className="mx-1 text-accent underline underline-offset-2 hover:text-seal">
                    全部合集
                </a>
            </p>
        </>
    )
}
