import type { Metadata } from 'next'
import { siteApi } from '@/lib/site-api'

export const metadata: Metadata = {
    title: '合集',
    description: '按主题串联的系列文章:一个话题从入门到上手,顺着读下去。',
    alternates: { canonical: '/collections' },
}

export default async function CollectionsPage() {
    // 兼容旧 API:接口还没上线时降级成空列表,不让整个构建失败
    const { data } = await siteApi.collections().catch(() => ({ data: [] }))
    const collections = [...data].sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'))

    return (
        <>
            <h1 className="text-balance font-serif text-[32px] leading-tight tracking-[-0.025em]">
                合集
            </h1>
            <p className="mt-2 mb-10 max-w-[58ch] text-[14px] leading-6 text-muted-foreground">
                按主题串联的系列文章。合集内按编辑排好的顺序读,每篇底部都有上一节 / 下一节。
            </p>

            {collections.length ? (
                <div className="border-t border-foreground/80">
                    {collections.map((c, i) => (
                        <a
                            key={c.slug}
                            href={`/collection/${c.slug}`}
                            className="group flex items-baseline gap-5 border-b border-border py-5"
                        >
                            <span className="hidden w-6 flex-none font-mono text-[11px] text-muted-foreground sm:block">
                                {String(i + 1).padStart(2, '0')}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="title-underline font-serif text-[20px] leading-snug transition-colors group-hover:text-accent">
                                    {c.title}
                                </span>
                                {c.description ? (
                                    <span className="mt-1 block text-[12.5px] leading-5 text-muted-foreground">
                                        {c.description}
                                    </span>
                                ) : null}
                            </span>
                            <span className="flex flex-none items-baseline gap-3 font-mono text-[10.5px] text-muted-foreground">
                                {c.articleCount} 篇
                                <span className="transition-transform duration-300 group-hover:translate-x-0.5">
                                    →
                                </span>
                            </span>
                        </a>
                    ))}
                </div>
            ) : (
                <div className="border border-dashed border-border bg-card p-14 text-center text-sm text-muted-foreground">
                    合集整理中,先去
                    <a href="/articles" className="mx-1 text-accent underline underline-offset-2">
                        文章
                    </a>
                    看看
                </div>
            )}
        </>
    )
}
