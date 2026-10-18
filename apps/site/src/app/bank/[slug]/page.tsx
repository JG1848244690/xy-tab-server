import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { QuestionCard } from '@/components/question-card'
import { siteApi, absoluteUrl } from '@/lib/site-api'

type Props = { params: Promise<{ slug: string }> }

/** 集合为空时的占位参数:output:export 不允许 gSP 返回空数组 */
const EMPTY_PLACEHOLDER = '_empty'

// 静态导出:未在 generateStaticParams 列出的 slug 不做动态兜底
export const dynamicParams = false

/** 构建期:给每个 bank 预生成静态页 */
export async function generateStaticParams() {
    const banks = await siteApi.banks().catch(() => ({ data: [] }))
    return banks.data.length
        ? banks.data.map((b) => ({ slug: b.slug }))
        : [{ slug: EMPTY_PLACEHOLDER }]
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    try {
        const bank = await siteApi.bank(slug)
        return {
            title: bank.title,
            description: bank.description ?? `${bank.title},共 ${bank.questionCount} 道面试题。`,
            alternates: { canonical: `/bank/${slug}` },
            openGraph: { url: absoluteUrl(`/bank/${slug}`) },
        }
    } catch {
        return { title: '题库' }
    }
}

export default async function BankPage({ params }: Props) {
    const { slug } = await params
    if (slug === EMPTY_PLACEHOLDER) {
        return <div className="empty">题库整理中,先看看热门题目吧</div>
    }
    const bank = await siteApi.bank(slug).catch(() => notFound())

    return (
        <>
            <h1 className="page-title">{bank.title}</h1>
            {bank.description ? <p style={{ color: 'var(--muted)' }}>{bank.description}</p> : null}
            {bank.questions.length ? (
                bank.questions.map((q) => <QuestionCard key={q.slug} q={q} />)
            ) : (
                <div className="empty">这个题库还没有已发布的题目</div>
            )}
        </>
    )
}
