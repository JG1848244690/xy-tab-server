import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { QuestionRow } from '@/components/rows'
import { siteApi } from '@/lib/site-api'

type Props = { params: Promise<{ slug: string }> }

/** 集合为空时的占位参数:output:export 不允许 gSP 返回空数组 */
const EMPTY_PLACEHOLDER = '_empty'

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
        }
    } catch {
        return { title: '题库' }
    }
}

export default async function BankPage({ params }: Props) {
    const { slug } = await params
    if (slug === EMPTY_PLACEHOLDER) {
        return <div className="rounded-xl border border-dashed border-border bg-muted p-14 text-center text-sm text-muted-foreground">题库整理中,先看看首页的最新题目</div>
    }
    const bank = await siteApi.bank(slug).catch(() => notFound())

    return (
        <>
            <h1 className="text-balance font-serif text-[32px] leading-tight tracking-[-0.025em]">{bank.title}</h1>
            <p className="mt-2 mb-7 max-w-[62ch] text-[15px] text-muted-foreground">
                {bank.description ?? `共 ${bank.questionCount} 道已发布题目。`}
            </p>
            {bank.questions.length ? (
                <div className="border-t border-border">
                    {bank.questions.map((q, i) => (
                        <QuestionRow key={q.slug} q={q} index={i + 1} />
                    ))}
                </div>
            ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted p-14 text-center text-sm text-muted-foreground">
                    这个题库还没有已发布的题目
                </div>
            )}
        </>
    )
}
