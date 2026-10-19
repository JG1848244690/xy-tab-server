import type { Metadata } from 'next'
import { siteApi } from '@/lib/site-api'

export const metadata: Metadata = {
    title: '全部标签',
    description: '按标签浏览面试题,覆盖前端、算法与工程实践主题。',
    alternates: { canonical: '/tags' },
}

export default async function TagsPage() {
    const tags = await siteApi.tags()

    return (
        <>
            <h1 className="text-balance text-[26px] font-bold tracking-[-0.022em]">标签</h1>
            <p className="mt-2 mb-7 max-w-[62ch] text-[15px] text-muted-foreground">
                按主题横向串联题目;介绍不足 240 字的标签页不会被收录。
            </p>
            <div className="flex flex-wrap gap-2">
                {tags.data.map((t) => (
                    <a
                        key={t.slug}
                        href={`/tag/${t.slug}`}
                        className="rounded-full border border-border bg-card px-4 py-1.5 text-[13.5px] text-foreground/85 transition-colors hover:border-accent hover:text-accent"
                    >
                        {t.name}
                        <small className="ml-1.5 font-mono text-muted-foreground">{t.questionCount}</small>
                    </a>
                ))}
                {tags.data.length === 0 ? (
                    <div className="w-full rounded-xl border border-dashed border-border bg-muted p-14 text-center text-sm text-muted-foreground">
                        还没有登记标签
                    </div>
                ) : null}
            </div>
        </>
    )
}
