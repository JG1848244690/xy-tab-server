import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { siteApi } from '@/lib/site-api'
import { groupIntoIssues } from '@/lib/digest'
import { DigestClickClient } from '@/components/digest-click-client'

type Props = { params: Promise<{ issue: string }> }

const EMPTY_PLACEHOLDER = '_empty'

export const dynamicParams = false

/** 构建期:每个有 curated 荐文的周生成一期 */
export async function generateStaticParams() {
    const curated = await siteApi
        .articles({ kind: 'curated', size: 50 })
        .catch(() => ({ data: [] as never[] }))
    const issues = groupIntoIssues(curated.data)
    return issues.length ? issues.map((i) => ({ issue: i.issue })) : [{ issue: EMPTY_PLACEHOLDER }]
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { issue } = await params
    return {
        title: `${issue} 期 · 每周荟萃`,
        alternates: { canonical: `/digest/${issue}` },
    }
}

export default async function DigestIssuePage({ params }: Props) {
    const { issue } = await params
    if (issue === EMPTY_PLACEHOLDER) {
        return <div className="rounded-xl border border-dashed border-border bg-muted p-14 text-center text-sm text-muted-foreground">第一期筹备中</div>
    }
    const curated = await siteApi.articles({ kind: 'curated', size: 50 })
    const issues = groupIntoIssues(curated.data)
    const current = issues.find((i) => i.issue === issue)
    if (!current) notFound()

    return (
        <>
            <h1 className="text-balance font-serif text-[32px] leading-tight tracking-[-0.025em]">{issue} 期</h1>
            <p className="mt-2 mb-7 text-[15px] text-muted-foreground">
                本周 {current.articles.length} 篇值得读的。
            </p>
            <div className="border-t border-border">
                {current.articles.map((a) => (
                    <div
                        key={a.slug}
                        className="border-b border-border border-l-2 border-l-accent px-2 py-4"
                    >
                        <h3 className="m-0 text-[15.5px] font-semibold leading-snug">
                            <a href={`/article/${a.slug}`} className="transition-colors hover:text-accent">
                                {a.title}
                            </a>
                        </h3>
                        <p className="mt-1 text-[13.5px] text-muted-foreground">{a.comment ?? a.excerpt}</p>
                        <div className="mt-1.5 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                            {a.sourceDomain ? <span>{a.sourceDomain}</span> : null}
                            <DigestClickClient slug={a.slug} />
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-6">
                <a href="/digest" className="text-[13px] text-accent">
                    ← 往期荟萃
                </a>
            </div>
        </>
    )
}
