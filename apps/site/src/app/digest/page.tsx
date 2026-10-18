import type { Metadata } from 'next'
import Link from 'next/link'
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
            <p style={{ color: 'var(--muted)' }}>每周一期,只荐值得读完的。</p>
            {issues.length ? (
                issues.map((issue) => (
                    <Link key={issue.issue} href={`/digest/${issue.issue}`} className="card" style={{ display: 'block' }}>
                        <h3>{issue.issue} 期</h3>
                        <p>{issue.articles.length} 篇导读</p>
                        <div className="meta-row">
                            {issue.articles.slice(0, 3).map((a) => (
                                <span key={a.slug}>{a.title}</span>
                            ))}
                        </div>
                    </Link>
                ))
            ) : (
                <div className="empty">第一期筹备中</div>
            )}
        </>
    )
}
