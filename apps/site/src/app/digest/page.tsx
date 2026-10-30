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
            <h1 className="text-balance font-serif text-[32px] leading-tight tracking-[-0.025em]">每周荟萃</h1>
            <p className="mt-2 mb-10 text-[14px] text-muted-foreground">
                一周一期,只荐值得读完的,附编辑点评。
            </p>
            {issues.length ? (
                <div className="border-t border-foreground/80">
                    {issues.map((issue) => (
                        <a
                            key={issue.issue}
                            href={`/digest/${issue.issue}`}
                            className="group -mx-3 block border-b border-border px-3 py-4 transition-colors hover:bg-card/70"
                        >
                            <h3 className="m-0 flex items-baseline gap-3 font-serif text-[18px]">
                                <span className="min-w-0 transition-colors group-hover:text-accent">
                                    {issue.issue} 期
                                </span>
                                <span className="flex-none font-mono text-[10.5px] text-muted-foreground">
                                    {issue.articles.length} 篇
                                </span>
                            </h3>
                            <p className="mt-1 text-[12.5px] leading-5 text-muted-foreground">
                                {issue.articles.map((a) => a.title).join(' · ')}
                            </p>
                        </a>
                    ))}
                </div>
            ) : (
                <div className="border-y border-dashed border-border py-14 text-center text-sm text-muted-foreground">
                    第一期筹备中
                </div>
            )}
        </>
    )
}
