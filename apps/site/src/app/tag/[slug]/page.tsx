import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { QuestionRow } from '@/components/rows'
import { siteApi } from '@/lib/site-api'

type Props = { params: Promise<{ slug: string }> }

const EMPTY_PLACEHOLDER = '_empty'

export const dynamicParams = false

export async function generateStaticParams() {
    const tags = await siteApi.tags().catch(() => ({ data: [] }))
    // 0 题的标签页不生成;legacy 是历史遗留别名(doc/hash/js),不对外提供聚合页
    const active = tags.data.filter((t) => t.questionCount > 0 && t.kind !== 'legacy')
    return active.length ? active.map((t) => ({ slug: t.slug })) : [{ slug: EMPTY_PLACEHOLDER }]
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const tags = await siteApi.tags()
    const tag = tags.data.find((t) => t.slug === slug)
    if (!tag) return { title: '标签' }
    return {
        title: `${tag.name} 面试题`,
        description:
            tag.description?.slice(0, 150) ??
            `关于 ${tag.name} 的面试题合集,共 ${tag.questionCount} 题。`,
        alternates: { canonical: `/tag/${slug}` },
        // 防薄内容惩罚:没有 ≥240 字介绍的聚合页 noindex(plan §8 风险 2)
        robots: tag.hasIntro ? undefined : { index: false, follow: true },
    }
}

export default async function TagPage({ params }: Props) {
    const { slug } = await params
    if (slug === EMPTY_PLACEHOLDER) {
        return <div className="rounded-xl border border-dashed border-border bg-muted p-14 text-center text-sm text-muted-foreground">标签整理中</div>
    }
    const tags = await siteApi.tags()
    const tag = tags.data.find((t) => t.slug === slug)
    if (!tag) notFound()

    const list = await siteApi.questions({ tag: tag.name, size: 50 })

    return (
        <>
            <h1 className="text-balance text-[26px] font-bold tracking-[-0.022em]">
                {tag.name} 面试题
            </h1>
            {tag.description ? (
                <p className="mt-2 mb-7 max-w-[65ch] text-[15px] leading-relaxed text-muted-foreground">
                    {tag.description}
                </p>
            ) : (
                <p className="mt-2 mb-7 text-sm text-muted-foreground">
                    介绍文案整理中,本页暂不参与收录。
                </p>
            )}

            {list.data.length ? (
                <div className="border-t border-border">
                    {list.data.map((q, i) => (
                        <QuestionRow key={q.slug} q={q} index={i + 1} />
                    ))}
                </div>
            ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted p-14 text-center text-sm text-muted-foreground">
                    这个标签下还没有已发布的题目
                </div>
            )}

            <div className="mt-6">
                <Link href="/tags" className="text-[13px] text-accent">
                    ← 全部标签
                </Link>
            </div>
        </>
    )
}
