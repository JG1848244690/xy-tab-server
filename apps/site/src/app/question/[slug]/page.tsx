import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DiffBadge } from '@/components/rows'
import { CopyButton } from '@/components/copy-button'
import { ReadingProgress } from '@/components/reading-progress'
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

/**
 * 三级标签中的一组。slug 直接取 tag_registry(全 ASCII):
 * 非 ASCII 的 slug 在 `output: export` 下会导出成 404,不能再由名称拼。
 */
function TagLinks({
    label,
    items,
    slugByName,
}: {
    label: string
    items: string[]
    slugByName: Map<string, string>
}) {
    if (!items.length) return null
    return (
        <div className="flex items-start gap-3 py-0.5 text-[12.5px]">
            <span className="w-10 shrink-0 text-muted-foreground">{label}</span>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
                {items.map((t) => {
                    const s = slugByName.get(t)
                    return s ? (
                        <Link
                            key={t}
                            href={`/tag/${s}`}
                            className="border-b border-transparent text-foreground/85 transition-colors hover:border-seal hover:text-seal"
                        >
                            {t}
                        </Link>
                    ) : (
                        <span key={t} className="text-foreground/70" title="暂无标签页">
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
    // 只有注册在 tag_registry 的标签才有独立页面;名字 → ASCII slug
    const slugByName = new Map(
        (await siteApi.tags().catch(() => ({ data: [] }))).data
            .filter((t) => t.questionCount > 0 && t.kind !== 'legacy')
            .map((t) => [t.name, t.slug] as const),
    )

    // JSON-LD 里可能包含 UGC 的 `</script>`(代码示例),必须转义 `<`,
    // 否则会提前闭合 script 标签,引发页面内联脚本 SyntaxError(2026-10-29 实测)
    const jsonLd = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c')

    // 有些导入题的 content 只是标题的复读(题干=标题),页面上等于空白。
    // 这种题直接不渲染「题干」块,只留参考答案(2026-10-29 走查)
    const normalize = (s: string) => s.replace(/\s+/g, '')
    const showStem = q.content.trim().length > 0 && normalize(q.content) !== normalize(q.title)

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
            <ReadingProgress />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(qaJsonLd) }} />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbJsonLd) }}
            />

            <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-14">
                {/* 阅读列 */}
                <div className="min-w-0">
                    <div className="border-b border-foreground/20 pb-5">
                        <p className="mb-3 font-mono text-[10.5px] tracking-[0.14em] text-muted-foreground">
                            {q.bankSlug ? `${q.bankSlug} / ` : ''}INTERVIEW NOTES
                        </p>
                        <h1 className="text-balance font-serif text-[30px] leading-[1.28] tracking-[-0.025em] sm:text-[38px]">
                            {q.title}
                        </h1>
                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] text-muted-foreground">
                            <DiffBadge difficulty={q.difficulty} />
                            {q.publishedAt ? <span>{q.publishedAt.slice(0, 10)}</span> : null}
                            {q.techStack ? <span>{q.techStack}</span> : null}
                        </div>
                    </div>

                    {showStem ? (
                        <>
                            <h2 className="mb-3 mt-8 flex items-center gap-2.5 font-serif text-[17px]">
                                <span className="size-1.5 bg-seal" aria-hidden />
                                题干
                            </h2>
                            <div className="prose prose-sm max-w-none rounded-[3px] border border-border bg-card/80 p-5 sm:prose-base sm:p-7 dark:prose-invert prose-pre:rounded-[3px] prose-pre:border">
                                <Markdown>{q.content}</Markdown>
                            </div>
                        </>
                    ) : null}

                    <h2 className="mb-3 mt-8 flex items-center gap-2.5 font-serif text-[17px]">
                        <span className="size-1.5 bg-seal" aria-hidden />
                        参考答案
                    </h2>
                    {q.answer.trim() ? (
                        <>
                            <div className="prose prose-sm max-w-none rounded-[3px] border border-border bg-card/80 p-5 sm:prose-base sm:p-7 dark:prose-invert prose-pre:rounded-[3px] prose-pre:border">
                                <Markdown>{q.answer}</Markdown>
                            </div>
                            <CopyButton text={q.answer} slug={slug} />
                        </>
                    ) : (
                        <div className="rounded-[3px] border border-dashed border-border bg-muted p-7 text-center text-sm text-muted-foreground">
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

                {/* 页边注:桌面 sticky,移动端落到正文后 */}
                <aside className="grid gap-7 self-start text-sm max-lg:static lg:sticky lg:top-[84px]">
                    <div className="border-t border-foreground/80 pt-3">
                        <h3 className="margin-title mb-2">题目信息</h3>
                        <div className="flex items-center justify-between gap-3 py-0.5 text-[12.5px]">
                            <span className="text-muted-foreground">难度</span>
                            <DiffBadge difficulty={q.difficulty} />
                        </div>
                        {q.publishedAt ? (
                            <div className="flex items-center justify-between gap-3 py-0.5 text-[12.5px]">
                                <span className="text-muted-foreground">发布</span>
                                <b className="font-mono font-normal">{q.publishedAt.slice(0, 10)}</b>
                            </div>
                        ) : null}
                        {q.direction || q.techStack || q.knowledgePoints?.length ? (
                            <div className="mt-3 space-y-1 border-t border-border pt-2">
                                <TagLinks
                                    label="方向"
                                    items={q.direction ? [q.direction] : []}
                                    slugByName={slugByName}
                                />
                                <TagLinks
                                    label="技术栈"
                                    items={q.techStack ? [q.techStack] : []}
                                    slugByName={slugByName}
                                />
                                <TagLinks
                                    label="知识点"
                                    items={q.knowledgePoints ?? []}
                                    slugByName={slugByName}
                                />
                            </div>
                        ) : q.tags?.length ? (
                            <div className="mt-3 border-t border-border pt-2">
                                <TagLinks label="标签" items={q.tags} slugByName={slugByName} />
                            </div>
                        ) : null}
                    </div>

                    <div className="border-t border-border pt-3">
                        <p className="font-serif text-[14.5px]">发现答案有误?</p>
                        <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                            众人拾柴火焰高,欢迎补充或纠错这道题。
                        </p>
                        <a
                            href={`${WEB_URL}/test-center`}
                            className="seal-link mt-2 inline-flex items-center gap-2 text-[12px] text-foreground transition-colors hover:text-seal"
                        >
                            去贡献
                            <span className="seal" aria-hidden>
                                献
                            </span>
                        </a>
                    </div>

                    {related.length ? (
                        <div className="border-t border-border pt-3">
                            <h3 className="margin-title mb-1.5">相关题目</h3>
                            <div>
                                {related.slice(0, 8).map((item) => (
                                    <a
                                        key={item.slug}
                                        href={`/question/${item.slug}`}
                                        className="group -mx-1.5 flex items-baseline justify-between gap-2.5 px-1.5 py-2 transition-colors hover:bg-muted/60"
                                    >
                                        <span className="title-underline min-w-0 font-serif text-[13.5px] leading-5 transition-colors group-hover:text-accent">
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
