import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DiffBadge } from '@/components/rows'
import { CopyButton } from '@/components/copy-button'
import { siteApi, absoluteUrl } from '@/lib/site-api'
import { renderMarkdown as renderMarkdownSafe } from '@/lib/markdown'

type Props = { params: Promise<{ slug: string }> }

export const dynamicParams = false

/** 构建期:全部已发布题目各预生成一页(数据源 sitemap-data) */
export async function generateStaticParams() {
    const data = await siteApi.sitemapData()
    return data.questions.map((q) => ({ slug: q.slug }))
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
    const q = await siteApi.question(slug).catch(() => notFound())
    const [contentHtml, answerHtml, related] = await Promise.all([
        renderMarkdownSafe(q.content),
        renderMarkdownSafe(q.answer),
        relatedByTag(slug, q.tags),
    ])

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

            <div className="q-layout">
                {/* 阅读列 */}
                <div>
                    <div className="q-head">
                        <h1 className="page-title">{q.title}</h1>
                        <div className="meta-row">
                            <DiffBadge difficulty={q.difficulty} />
                            {q.publishedAt ? <span>{q.publishedAt.slice(0, 10)}</span> : null}
                            <span>{q.viewCount} 次浏览</span>
                        </div>
                    </div>

                    <div className="q-section-label">题干</div>
                    <div className="markdown" dangerouslySetInnerHTML={{ __html: contentHtml }} />

                    <div className="q-section-label">参考答案</div>
                    {q.answer.trim() ? (
                        <div
                            className="markdown answer-block"
                            dangerouslySetInnerHTML={{ __html: answerHtml }}
                        />
                    ) : (
                        <div className="empty">
                            这道题的答案还在整理中。可以先看题干自己作答,
                            <a href={`${process.env.NEXT_PUBLIC_WEB_URL ?? 'https://hls.kskbl.com.cn/test-center'}/test-center/practice/${q.id}`} style={{ color: 'var(--accent)' }}>
                                去练习页作答
                            </a>
                            ,或过几天再来。
                        </div>
                    )}
                    {q.answer.trim() ? <CopyButton text={q.answer} slug={slug} /> : null}
                </div>

                {/* 信息栏:桌面 sticky,移动端落到正文后 */}
                <aside className="q-aside">
                    <div className="aside-card">
                        <h3>题目信息</h3>
                        <div className="kv">
                            <span>难度</span>
                            <b>
                                <DiffBadge difficulty={q.difficulty} />
                            </b>
                        </div>
                        <div className="kv">
                            <span>浏览</span>
                            <b>{q.viewCount}</b>
                        </div>
                        {q.publishedAt ? (
                            <div className="kv">
                                <span>发布</span>
                                <b>{q.publishedAt.slice(0, 10)}</b>
                            </div>
                        ) : null}
                        {q.tags?.length ? (
                            <div className="kv" style={{ display: 'block' }}>
                                <span style={{ display: 'block', marginBottom: 6 }}>标签</span>
                                <div className="tags">
                                    {q.tags.map((t) => (
                                        <Link
                                            key={t}
                                            href={`/tag/${encodeURIComponent(t.toLowerCase().replace(/\s+/g, '-'))}`}
                                            className="pill"
                                        >
                                            {t}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {related.length ? (
                        <div className="aside-card">
                            <h3>相关题目</h3>
                            <div className="list">
                                {related.slice(0, 8).map((item) => (
                                    <a key={item.slug} href={`/question/${item.slug}`} className="row">
                                        <h3>
                                            <span className="row-title">{item.title}</span>
                                            <DiffBadge difficulty={item.difficulty} />
                                        </h3>
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
