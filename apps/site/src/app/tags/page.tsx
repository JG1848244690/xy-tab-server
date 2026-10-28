import type { Metadata } from 'next'
import { siteApi } from '@/lib/site-api'

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://hls.kskbl.com.cn'

export const metadata: Metadata = {
    title: '全部标签',
    description: '按方向、技术栈、知识点浏览面试题,覆盖前端、后端、算法与 Agent。',
    alternates: { canonical: '/tags' },
}

const GROUPS = [
    { kind: 'direction', label: '方向', hint: '先选大方向,再往下钻' },
    { kind: 'stack', label: '技术栈', hint: 'Vue / React / JavaScript / MySQL…' },
    { kind: 'point', label: '知识点', hint: '闭包 / 事件循环 / B+树…' },
]

export default async function TagsPage() {
    const tags = await siteApi.tags()
    const canonical = tags.data.filter((t) => GROUPS.some((g) => g.kind === t.kind))

    return (
        <>
            <h1 className="text-balance text-[26px] font-bold tracking-[-0.022em]">标签</h1>
            <p className="mt-2 mb-7 max-w-[62ch] text-[15px] text-muted-foreground">
                按「方向 → 技术栈 → 知识点」浏览题目;所有标签都由社区共同维护。
            </p>

            {GROUPS.map((g) => {
                const items = canonical.filter(
                    (t) => t.kind === g.kind && t.questionCount > 0,
                )
                if (!items.length) return null
                return (
                    <section key={g.kind} className="mb-8">
                        <div className="mb-3 flex items-baseline justify-between gap-3">
                            <h2 className="text-[17px] font-semibold">{g.label}</h2>
                            <span className="text-xs text-muted-foreground">{g.hint}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {items.map((t) => (
                                <a
                                    key={t.slug}
                                    href={`/tag/${t.slug}`}
                                    className="rounded-full border border-border bg-card px-4 py-1.5 text-[13.5px] text-foreground/85 transition-colors hover:border-accent hover:text-accent"
                                >
                                    {t.name}
                                    <small className="ml-1.5 font-mono text-muted-foreground">
                                        {t.questionCount}
                                    </small>
                                </a>
                            ))}
                        </div>
                    </section>
                )
            })}

            {canonical.filter((t) => t.questionCount > 0).length === 0 ? (
                <div className="w-full rounded-xl border border-dashed border-border bg-muted p-14 text-center text-sm text-muted-foreground">
                    还没有登记标签
                </div>
            ) : null}

            <div className="mt-10 rounded-xl border border-dashed border-border bg-muted/40 p-5">
                <p className="text-[15px] font-semibold">没有找到你要的方向?</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    众人拾柴火焰高。分享一道你遇到的面试题,或者补充/纠正现有答案。
                </p>
                <a
                    href={`${WEB_URL}/test-center`}
                    className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
                >
                    贡献一道题 →
                </a>
            </div>
        </>
    )
}
