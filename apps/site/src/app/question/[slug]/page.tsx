import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DiffBadge } from '@/components/rows'
import { CopyButton } from '@/components/copy-button'
import { Markdown } from '@/lib/markdown'
import { siteApi, absoluteUrl } from '@/lib/site-api'

type Props = { params: Promise<{ slug: string }> }

/** 集合为空时的占位参数:output:export 不允许 gSP 返回空数组 */
const EMPTY_PLACEHOLDER = '_empty'

export const dynamicParams = false

/** 构建期:全部已发布题目各预生成一页(数据源 sitemap-data) */
export async function generateStaticParams() {
    const data = await siteApi.sitemapData()
    // slug 为空的题 = 还没被 agent 清洗过(正常状态),没有可公开的 URL,跳过
    const slugged = data.questions.filter((q) => q.slug)
    return slugged.length ? slugged.map((q) => ({ slug: q.slug! })) : [{ slug: EMPTY_PLACEHOLDER }]
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const q = await siteApi.question(slug).catch(() => null)
    if (!q) return { title: '题目' }
    return {
        title: q.title,
        description: q.summary ?? `「${q.title}」的面试考察点、参考答案与记忆口诀。`,
        alternates: { canonical: `/question/${slug}` },
        openGraph: { url: absoluteUrl(`/question/${slug}`), title: q.title },
    }
}

/** 题目页底:同 tag 相关 10 题(plan §3.3 内链) */
async function relatedByTag(slug: string, tags: string[] | null) {
    const firstTag = tags?.[0]
    if (!firstTag) return []
    const list = await siteApi.questions({ tag: firstTag, size: 11 })
    return list.data.filter((q) => q.slug !== slug).slice(0, 10)
}

export default async function QuestionPage({ params }: Props) {
    const { slug } = await params
    if (slug === EMPTY_PLACEHOLDER) {
        return <div className="rounded-xl border border-dashed border-border bg-muted p-14 text-center text-sm text-muted-foreground">内容马上就来</div>
    }
    const q = await siteApi.question(slug).catch(() => notFound())
    const related = await relatedByTag(slug, q.tags)

    // QAPage 结构化数据:题目富摘要 / AEO 引用的核心信号
    const qaJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'QAPage',
        mainEntity: {
            '@type': 'Question',
            name: q.title,
            text: q.content,
            answerCount: 1,
            acceptedAnswer: {
                '@type': 'Answer',
                text: q.answer,
                url: absoluteUrl(`/question/${slug}`),
            },
        },
    }
    const breadcrumbJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: '首页', item: absoluteUrl('/') },
            ...(q.bankSlug
                ? [{ '@type': 'ListItem', position: 2, name: '题库', item: absoluteUrl(`/bank/${q.bankSlug}`) }]
                : []),
            {
                '@type': 'ListItem',
                position: q.bankSlug ? 3 : 2,
                name: q.title,
                item: absoluteUrl(`/question/${slug}`),
            },
        ],
    }

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(qaJsonLd) }} />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />

            <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
                {/* 阅读列 */}
                <div className="min-w-0">
                    <div className="border-b border-border pb-5">
                        <h1 className="text-balance text-[26px] font-bold leading-[1.3] tracking-[-0.022em] sm:text-[28px]">
                            {q.title}
                        </h1>
                        <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[12.5px] text-muted-foreground">
                            <DiffBadge difficulty={q.difficulty} />
                            {q.publishedAt ? <span>{q.publishedAt.slice(0, 10)}</span> : null}
                        </div>
                    </div>

                    <h2 className="mt-7 mb-2.5 text-[15px] font-semibold">题干</h2>
                    <div className="prose prose-sm max-w-none rounded-xl border border-border bg-card p-5 shadow-sm sm:prose-base sm:p-6 dark:prose-invert prose-pre:rounded-lg prose-pre:border">
                        <Markdown>{q.content}</Markdown>
                    </div>

                    <h2 className="mt-7 mb-2.5 text-[15px] font-semibold">参考答案</h2>
                    {q.answer.trim() ? (
                        <>
                            <div className="prose prose-sm max-w-none rounded-xl border border-border bg-card p-5 shadow-sm sm:prose-base sm:p-6 dark:prose-invert prose-pre:rounded-lg prose-pre:border">
                                <Markdown>{q.answer}</Markdown>
                            </div>
                            <CopyButton text={q.answer} slug={slug} />
                        </>
                    ) : (
                        <div className="rounded-xl border border-dashed border-border bg-muted p-7 text-center text-sm text-muted-foreground">
                            这道题的答案还在整理中。可以先看题干自己作答,
                            <a
                                href={`${process.env.NEXT_PUBLIC_WEB_URL ?? 'https://hls.kskbl.com.cn/test-center'}/test-center/practice/${q.id}`}
                                className="text-accent underline underline-offset-[3px]"
                            >
                                去练习页作答
                            </a>
                            ,或过几天再来。
                        </div>
                    )}
                </div>

                {/* 信息栏:桌面 sticky,移动端落到正文后 */}
                <aside className="grid gap-4 self-start text-sm max-lg:static lg:sticky lg:top-[78px]">
                    <div className="rounded-xl border border-border bg-card p-4">
                        <h3 className="mb-2.5 text-[13px] font-semibold text-muted-foreground">题目信息</h3>
                        <div className="flex items-center justify-between gap-3 py-0.5 text-[13.5px]">
                            <span className="text-muted-foreground">难度</span>
                            <DiffBadge difficulty={q.difficulty} />
                        </div>
                        {q.publishedAt ? (
                            <div className="flex items-center justify-between gap-3 py-0.5 text-[13.5px]">
                                <span className="text-muted-foreground">发布</span>
                                <b className="font-semibold">{q.publishedAt.slice(0, 10)}</b>
                            </div>
                        ) : null}
                        {q.tags?.length ? (
                            <div className="pt-1">
                                <span className="mb-1.5 block text-muted-foreground">标签</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {q.tags.map((t) => (
                                        <Link
                                            key={t}
                                            href={`/tag/${encodeURIComponent(t.toLowerCase().replace(/\s+/g, '-'))}`}
                                            className="rounded-full border border-border px-2.5 py-px text-xs text-muted-foreground transition-colors hover:border-accent hover:text-accent"
                                        >
                                            {t}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {related.length ? (
                        <div className="rounded-xl border border-border bg-card p-4">
                            <h3 className="mb-2 text-[13px] font-semibold text-muted-foreground">相关题目</h3>
                            <div>
                                {related.slice(0, 8).map((item) => (
                                    <a
                                        key={item.slug}
                                        href={`/question/${item.slug}`}
                                        className="group -mx-1.5 flex items-baseline justify-between gap-2.5 rounded-lg px-1.5 py-2.5 text-[13.5px] transition-colors hover:bg-muted"
                                    >
                                        <span className="min-w-0 transition-colors group-hover:text-accent">
                                            {item.title}
                                        </span>
                                        <DiffBadge difficulty={item.difficulty} />
                                    </a>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </aside>
            </div>
        </>
    )
}
