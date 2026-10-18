import type { Metadata } from 'next'
import { siteApi } from '@/lib/site-api'
import { groupIntoIssues } from '@/lib/digest'

export const metadata: Metadata = {
    title: '每周荟萃',
    description: '每周一期:值得读的前端与算法文章导读,附编辑点评。',
    alternates: { canonical: '/digest' },
}

export default async function DigestPage() {
    const curated = await siteApi.articles({ kind: 'curated', size: 50 })
    const issues = groupIntoIssues(curated.data)

    return (
        <>
            <h1 className="page-title">每周荟萃</h1>
            <p className="page-sub">一周一期,只荐值得读完的,附编辑点评。</p>
            {issues.length ? (
                <div className="list">
                    {issues.map((issue) => (
                        <a key={issue.issue} href={`/digest/${issue.issue}`} className="row">
                            <h3>
                                <span className="row-title">{issue.issue} 期</span>
                                <span className="diff diff-easy">{issue.articles.length} 篇</span>
                            </h3>
                            <p>{issue.articles.map((a) => a.title).join(' · ')}</p>
                        </a>
                    ))}
                </div>
            ) : (
                <div className="empty">第一期筹备中</div>
            )}
        </>
    )
}
