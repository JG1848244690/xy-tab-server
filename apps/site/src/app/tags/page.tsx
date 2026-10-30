import type { Metadata } from 'next'
import { siteApi } from '@/lib/site-api'

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://hls.kskbl.com.cn'

export const metadata: Metadata = {
    title: '全部标签',
    description: '按方向、技术栈、知识点浏览面试题,覆盖前端、后端、算法与 Agent。',
    alternates: { canonical: '/tags' },
}

const GROUPS = [
    { kind: 'direction', label: '方向', hint: '先选大方向' },
    { kind: 'stack', label: '技术栈', hint: '按语言与框架' },
    { kind: 'point', label: '知识点', hint: '按具体原理' },
]

export default async function TagsPage() {
    const tags = await siteApi.tags()
    const canonical = tags.data.filter((t) => GROUPS.some((g) => g.kind === t.kind))

    return (
        <>
            <h1 className="text-balance font-serif text-[32px] leading-tight tracking-[-0.025em]">
                标签
            </h1>
            <p className="mt-2 mb-10 max-w-[58ch] text-[14px] leading-6 text-muted-foreground">
                按「方向 → 技术栈 → 知识点」浏览题目。所有标签都由社区共同维护。
            </p>

            {GROUPS.map((g) => {
                const items = canonical.filter((t) => t.kind === g.kind && t.questionCount > 0)
                if (!items.length) return null
                return (
                    <section key={g.kind} className="mb-10">
                        <div className="flex items-baseline justify-between border-b border-foreground/80 pb-2">
                            <h2 className="font-serif text-[15px] tracking-[0.04em]">{g.label}</h2>
                            <span className="text-[11px] text-muted-foreground">{g.hint}</span>
                        </div>
                        <div className="mt-3 grid gap-x-10 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                            {items.map((t) => (
                                <a
                                    key={t.slug}
                                    href={`/tag/${t.slug}`}
                                    className="group flex items-baseline gap-2 border-b border-border/60 py-2 text-[13.5px]"
                                >
                                    <span className="title-underline min-w-0 transition-colors group-hover:text-accent">
                                        {t.name}
                                    </span>
                                    <span className="leader" />
                                    <span className="flex-none font-mono text-[10.5px] text-muted-foreground">
                                        {t.questionCount}
                                    </span>
                                </a>
                            ))}
                        </div>
                    </section>
                )
            })}

            {canonical.filter((t) => t.questionCount > 0).length === 0 ? (
                <div className="border border-dashed border-border bg-card p-14 text-center text-sm text-muted-foreground">
                    还没有登记标签
                </div>
            ) : null}

            <div className="mt-12 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[13px] leading-6 text-muted-foreground">
                    没有找到你要的方向?分享一道题,或者补一个标签。
                </p>
                <a
                    href={`${WEB_URL}/test-center`}
                    className="seal-link flex flex-none items-center gap-2 text-[13px] text-foreground transition-colors hover:text-seal"
                >
                    贡献一道题
                    <span className="seal" aria-hidden>
                        献
                    </span>
                </a>
            </div>
        </>
    )
}
