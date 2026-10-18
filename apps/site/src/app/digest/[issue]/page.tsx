import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { siteApi } from '@/lib/site-api'
import { groupIntoIssues } from '@/lib/digest'
import { DigestClickClient } from '@/components/digest-click-client'

type Props = { params: Promise<{ issue: string }> }

/** 集合为空时的占位参数(output:export 不允许 gSP 返回空数组) */
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
        return <div className="empty">第一期筹备中</div>
    }
    const curated = await siteApi.articles({ kind: 'curated', size: 50 })
    const issues = groupIntoIssues(curated.data)
    const current = issues.find((i) => i.issue === issue)
    if (!current) notFound()

    return (
        <>
            <h1 className="page-title">{issue} 期</h1>
            <p className="page-sub">本周 {current.articles.length} 篇值得读的。</p>
            <div className="list">
                {current.articles.map((a) => (
                    <div key={a.slug} className="row curated-row">
                        <h3>
                            <a href={`/article/${a.slug}`}>
                                <span className="row-title">{a.title}</span>
                            </a>
                        </h3>
                        <p>{a.comment ?? a.excerpt}</p>
                        <div className="meta-row">
                            {a.sourceDomain ? <span className="src">{a.sourceDomain}</span> : null}
                            <DigestClickClient slug={a.slug} />
                        </div>
                    </div>
                ))}
            </div>
            <div className="section-head">
                <a href="/digest" style={{ color: 'var(--accent)', fontSize: 13 }}>
                    ← 往期荟萃
                </a>
            </div>
        </>
    )
}
