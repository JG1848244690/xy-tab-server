import type { QuestionListItem } from '@/lib/site-api'

/** 难度徽标:小、克制,只编码状态 */
export function DiffBadge({ difficulty }: { difficulty: QuestionListItem['difficulty'] }) {
    const label = difficulty === 'easy' ? '简单' : difficulty === 'medium' ? '中等' : '困难'
    const cls =
        difficulty === 'easy'
            ? 'text-easy'
            : difficulty === 'medium'
                ? 'text-medium'
                : 'text-hard'
    return (
        <span className={`flex-none font-mono text-[10.5px] ${cls}`}>
            {label}
        </span>
    )
}

/** 行式目录条目:题号 + 标题 + 摘要 + 标签 */
export function QuestionRow({ q, index }: { q: QuestionListItem; index?: number }) {
    const withIndex = index !== undefined
    return (
        <a
            href={`/question/${q.slug}`}
            className={[
                'group -mx-3 grid items-baseline gap-3 border-b border-border px-3 py-3.5 last:border-b-0 hover:bg-card/70',
                withIndex ? 'grid-cols-[2rem_minmax(0,1fr)_auto]' : 'grid-cols-[minmax(0,1fr)_auto]',
            ].join(' ')}
        >
            {withIndex ? (
                <span className="font-mono text-[10.5px] text-muted-foreground">
                    {String(index).padStart(2, '0')}
                </span>
            ) : null}
            <span className="min-w-0">
                <span className="title-underline font-serif text-[16.5px] leading-snug transition-colors group-hover:text-accent">
                    {q.title}
                </span>
                {q.summary ? (
                    <span className="mt-1 line-clamp-1 text-[12.5px] leading-5 text-muted-foreground">
                        {q.summary}
                    </span>
                ) : null}
                {q.tags?.length ? (
                    <span className="mt-1 flex flex-wrap gap-x-2 text-[10.5px] text-muted-foreground">
                        {q.tags.slice(0, 3).map((t) => (
                            <span key={t}>{t}</span>
                        ))}
                    </span>
                ) : null}
            </span>
            <DiffBadge difficulty={q.difficulty} />
        </a>
    )
}

/** 通用目录行(题库/标签等非题目条目) */
export function ListRow({
    href,
    title,
    desc,
    badge,
    meta,
}: {
    href: string
    title: string
    desc?: string | null
    badge?: React.ReactNode
    meta?: React.ReactNode
}) {
    return (
        <a
            href={href}
            className="group -mx-3 flex items-baseline justify-between gap-4 border-b border-border px-3 py-4 last:border-b-0 hover:bg-card/70"
        >
            <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-3">
                    <span className="title-underline font-serif text-[18px] leading-snug transition-colors group-hover:text-accent">
                        {title}
                    </span>
                </span>
                {desc ? (
                    <span className="mt-1 block text-[12.5px] leading-5 text-muted-foreground">
                        {desc}
                    </span>
                ) : null}
                {meta ? (
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[10.5px] text-muted-foreground">
                        {meta}
                    </span>
                ) : null}
            </span>
            <span className="flex flex-none items-baseline gap-3">
                {badge}
                <span className="font-mono text-[11px] text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5">
                    →
                </span>
            </span>
        </a>
    )
}
