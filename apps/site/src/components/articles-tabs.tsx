'use client'

import { useState } from 'react'
import type { ArticleListItem, CollectionListItem } from '@/lib/site-api'

type TabKey = 'own' | 'curated' | 'collections'

interface Props {
    own: ArticleListItem[]
    curated: ArticleListItem[]
    collections: CollectionListItem[]
}

/**
 * 文章页的模块切换。
 *
 * 之前三个模块(合集/原创/荐文)是纵向堆叠的,用户看不到下面的模块;
 * 现在用顶部吸顶 tab,数量直接标在标签上,一眼知道还有多少内容。
 */
export function ArticlesTabs({ own, curated, collections }: Props) {
    const [tab, setTab] = useState<TabKey>(own.length ? 'own' : 'curated')

    const tabs: Array<{ key: TabKey; label: string; count: number }> = [
        { key: 'own', label: '原创', count: own.length },
        { key: 'curated', label: '荐文', count: curated.length },
        { key: 'collections', label: '合集', count: collections.length },
    ]

    return (
        <>
            <nav className="sticky top-16 z-10 -mx-5 mb-6 flex items-center gap-1 border-b border-border bg-background/92 px-5 backdrop-blur-md sm:-mx-6 sm:px-6">
                {tabs.map((t) => {
                    const active = tab === t.key
                    return (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => setTab(t.key)}
                            className={[
                                '-mb-px flex items-baseline gap-1.5 border-b-2 px-3 py-2.5 text-[13.5px] transition-colors',
                                active
                                    ? 'border-seal font-medium text-foreground'
                                    : 'border-transparent text-muted-foreground hover:text-foreground',
                            ].join(' ')}
                        >
                            {t.label}
                            <span className="font-mono text-[10.5px] text-muted-foreground">
                                {t.count}
                            </span>
                        </button>
                    )
                })}
            </nav>

            {tab === 'own' ? <OwnList items={own} /> : null}
            {tab === 'curated' ? <CuratedList items={curated} /> : null}
            {tab === 'collections' ? <CollectionList items={collections} /> : null}
        </>
    )
}

function Empty({ text }: { text: string }) {
    return (
        <div className="border border-dashed border-border bg-card p-14 text-center text-sm text-muted-foreground">
            {text}
        </div>
    )
}

function OwnList({ items }: { items: ArticleListItem[] }) {
    if (!items.length) return <Empty text="原创文章整理中" />
    return (
        <div className="border-t border-foreground/80">
            {items.map((a) => (
                <a
                    key={a.slug}
                    href={`/article/${a.slug}`}
                    className="group -mx-3 flex items-baseline gap-4 border-b border-border px-3 py-4 hover:bg-card/70"
                >
                    <span className="min-w-0 flex-1">
                        <span className="font-serif text-[18px] leading-snug transition-colors group-hover:text-accent">
                            {a.title}
                        </span>
                        {a.excerpt ? (
                            <span className="mt-1 block line-clamp-2 text-[12.5px] leading-5 text-muted-foreground">
                                {a.excerpt}
                            </span>
                        ) : null}
                        <span className="mt-1.5 flex flex-wrap gap-x-3 font-mono text-[10.5px] text-muted-foreground">
                            {a.publishedAt ? <span>{a.publishedAt.slice(0, 10)}</span> : null}
                            {a.tags?.slice(0, 2).map((t) => <span key={t}>{t}</span>)}
                        </span>
                    </span>
                    <span className="flex-none font-mono text-[11px] text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5">
                        →
                    </span>
                </a>
            ))}
        </div>
    )
}

function CuratedList({ items }: { items: ArticleListItem[] }) {
    if (!items.length) return <Empty text="荐文征集 ing" />
    return (
        <div className="border-t border-foreground/80">
            {items.map((a) => (
                <a
                    key={a.slug}
                    href={`/article/${a.slug}`}
                    className="group -mx-3 flex items-baseline gap-4 border-b border-border px-3 py-3.5 hover:bg-card/70"
                >
                    <span className="min-w-0 flex-1">
                        <span className="font-serif text-[16.5px] leading-snug transition-colors group-hover:text-accent">
                            {a.title}
                        </span>
                        {a.comment ?? a.excerpt ? (
                            <span className="mt-1 block line-clamp-2 text-[12.5px] leading-5 text-muted-foreground">
                                {a.comment ?? a.excerpt}
                            </span>
                        ) : null}
                        <span className="mt-1.5 flex flex-wrap gap-x-3 font-mono text-[10.5px] text-muted-foreground">
                            {a.sourceDomain ? <span>{a.sourceDomain}</span> : null}
                            {a.publishedAt ? <span>{a.publishedAt.slice(0, 10)}</span> : null}
                        </span>
                    </span>
                    <span className="flex-none font-mono text-[10.5px] text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5">
                        ↗
                    </span>
                </a>
            ))}
        </div>
    )
}

function CollectionList({ items }: { items: CollectionListItem[] }) {
    if (!items.length) return <Empty text="合集整理中" />
    return (
        <div className="border-t border-foreground/80">
            {items.map((c) => (
                <a
                    key={c.slug}
                    href={`/collection/${c.slug}`}
                    className="group -mx-3 flex items-baseline gap-4 border-b border-border px-3 py-4 hover:bg-card/70"
                >
                    <span className="min-w-0 flex-1">
                        <span className="font-serif text-[18px] leading-snug transition-colors group-hover:text-accent">
                            {c.title}
                        </span>
                        {c.description ? (
                            <span className="mt-1 block line-clamp-2 text-[12.5px] leading-5 text-muted-foreground">
                                {c.description}
                            </span>
                        ) : null}
                    </span>
                    <span className="flex flex-none items-baseline gap-2 font-mono text-[10.5px] text-muted-foreground">
                        {c.articleCount} 篇
                        <span className="transition-transform duration-300 group-hover:translate-x-0.5">
                            →
                        </span>
                    </span>
                </a>
            ))}
        </div>
    )
}
