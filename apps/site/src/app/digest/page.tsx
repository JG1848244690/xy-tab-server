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
            <h1 className="text-balance text-[26px] font-bold tracking-[-0.022em]">每周荟萃</h1>
            <p className="mt-2 mb-7 text-[15px] text-muted-foreground">
                一周一期,只荐值得读完的,附编辑点评。
            </p>
            {issues.length ? (
                <div className="border-t border-border">
                    {issues.map((issue) => (
                        <a
                            key={issue.issue}
                            href={`/digest/${issue.issue}`}
                            className="group -mx-2 block rounded-lg border-b border-border px-2 py-4 transition-colors hover:bg-card"
                        >
                            <h3 className="m-0 flex items-baseline gap-3 text-[15.5px] font-semibold">
                                <span className="min-w-0 transition-colors group-hover:text-accent">
                                    {issue.issue} 期
                                </span>
                                <span className="flex-none rounded-full bg-easy-weak px-2.5 py-0.5 text-xs font-medium text-easy">
                                    {issue.articles.length} 篇
                                </span>
                            </h3>
                            <p className="mt-1 text-[13.5px] text-muted-foreground">
                                {issue.articles.map((a) => a.title).join(' · ')}
                            </p>
                        </a>
                    ))}
                </div>
            ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted p-14 text-center text-sm text-muted-foreground">
                    第一期筹备中
                </div>
            )}
        </>
    )
}
