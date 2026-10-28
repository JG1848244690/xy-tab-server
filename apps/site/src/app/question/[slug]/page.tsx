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
const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://hls.kskbl.com.cn'

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

const tagSlug = (t: string) => t.toLowerCase().replace(/[\/\s]+/g, '-')

/** 三级标签中的一组;没有独立标签页的标签渲染成纯文本,避免 404 */
function TagLinks({
    label,
    items,
    tagPages,
}: {
    label: string
    items: string[]
    tagPages: Set<string>
}) {
    if (!items.length) return null
    return (
        <div className="flex items-start gap-2 py-0.5 text-[13px]">
            <span className="w-12 shrink-0 text-muted-foreground">{label}</span>
            <div className="flex flex-wrap gap-1.5">
                {items.map((t) => {
                    const cls =
                        'rounded-full border border-border px-2.5 py-px text-xs text-muted-foreground'
                    return tagPages.has(tagSlug(t)) ? (
                        <Link
                            key={t}
                            href={`/tag/${encodeURIComponent(tagSlug(t))}`}
                            className={`${cls} transition-colors hover:border-accent hover:text-accent`}
                        >
                            {t}
                        </Link>
                    ) : (
                        <span key={t} className={cls} title="暂无标签页">
                            {t}
                        </span>
                    )
                })}
            </div>
        </div>
    )
}

export default async function QuestionPage({ params }: Props) {
    const { slug } = await params
    if (slug === EMPTY_PLACEHOLDER) {
        return <div className="rounded-xl border border-dashed border-border bg-muted p-14 text-center text-sm text-muted-foreground">内容马上就来</div>
    }
    const q = await siteApi.question(slug).catch(() => notFound())
    const related = await relatedByTag(
        slug,
        q.knowledgePoints?.length
            ? q.knowledgePoints
            : q.techStack
              ? [q.techStack]
              : q.tags,
    )
    // 只有注册在 tag_registry 的标签才有独立页面;临时标签渲染成纯文本,避免内链 404
    const tagPages = new Set(
        (await siteApi.tags().catch(() => ({ data: [] }))).data
            .filter((t) => t.questionCount > 0 && t.kind !== 'legacy')
            .map((t) => t.slug),
    )

    // QAPage 结构化数据:题目富摘要 / AEO 引用的核心信号
    // 2026-10-27:补 author / datePublished / upvoteCount(GSC 的 6 个改进项)
    const datePublished = q.publishedAt ?? q.updatedAt
    const author = {
        '@type': 'Organization',
        name: '序言',
        url: absoluteUrl('/'),
    }
    const qaJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'QAPage',
        mainEntity: {
            '@type': 'Question',
            name: q.title,
            // 题干为空是历史脏数据;兜底到标题,避免 text 再被判缺失
            text: q.content || q.title,
            author,
            datePublished,
            answerCount: 1,
            acceptedAnswer: {
                '@type': 'Answer',
                text: q.answer,
                url: absoluteUrl(`/question/${slug}`),
                author,
                datePublished,
                upvoteCount: 0,
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
                                href={`${WEB_URL}/test-center/practice/${q.id}`}
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
                        {q.direction || q.techStack || q.knowledgePoints?.length ? (
                            <div className="space-y-1.5 pt-1">
                                <TagLinks
                                    label="方向"
                                    items={q.direction ? [q.direction] : []}
                                    tagPages={tagPages}
                                />
                                <TagLinks
                                    label="技术栈"
                                    items={q.techStack ? [q.techStack] : []}
                                    tagPages={tagPages}
                                />
                                <TagLinks
                                    label="知识点"
                                    items={q.knowledgePoints ?? []}
                                    tagPages={tagPages}
                                />
                            </div>
                        ) : q.tags?.length ? (
                            <div className="pt-1">
                                <TagLinks label="标签" items={q.tags} tagPages={tagPages} />
                            </div>
                        ) : null}
                    </div>

                    <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4">
                        <p className="text-[13px] font-semibold">发现答案有误,或你有更好的解法?</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            众人拾柴火焰高,欢迎补充或纠错这道题。
                        </p>
                        <a
                            href={`${WEB_URL}/test-center`}
                            className="mt-2 inline-block text-xs font-medium text-accent hover:underline"
                        >
                            去贡献 →
                        </a>
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
