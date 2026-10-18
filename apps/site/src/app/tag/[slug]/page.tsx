import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { QuestionRow } from '@/components/rows'
import { siteApi } from '@/lib/site-api'

type Props = { params: Promise<{ slug: string }> }

/** 集合为空时的占位参数(output:export 不允许 gSP 返回空数组) */
const EMPTY_PLACEHOLDER = '_empty'

export const dynamicParams = false

export async function generateStaticParams() {
    const tags = await siteApi.tags().catch(() => ({ data: [] }))
    return tags.data.length
        ? tags.data.map((t) => ({ slug: t.slug }))
        : [{ slug: EMPTY_PLACEHOLDER }]
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
        return <div className="empty">标签整理中</div>
    }
    const tags = await siteApi.tags()
    const tag = tags.data.find((t) => t.slug === slug)
    if (!tag) notFound()

    const list = await siteApi.questions({ tag: tag.name, size: 50 })

    return (
        <>
            <h1 className="page-title">{tag.name} 面试题</h1>
            {tag.description ? (
                <div className="markdown" style={{ marginBottom: 24 }}>
                    <p>{tag.description}</p>
                </div>
            ) : null}

            {list.data.length ? (
                <div className="list">
                    {list.data.map((q, i) => (
                        <QuestionRow key={q.slug} q={q} index={i + 1} />
                    ))}
                </div>
            ) : (
                <div className="empty">这个标签下还没有已发布的题目</div>
            )}

            <div className="section-head">
                <Link href="/tags" style={{ color: 'var(--accent)', fontSize: 13 }}>
                    ← 全部标签
                </Link>
            </div>
        </>
    )
}
