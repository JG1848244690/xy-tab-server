import Link from 'next/link'
import type { QuestionListItem } from '@/lib/site-api'

/** 难度徽标:颜色只编码状态 */
export function DiffBadge({ difficulty }: { difficulty: QuestionListItem['difficulty'] }) {
    const label = difficulty === 'easy' ? '简单' : difficulty === 'medium' ? '中等' : '困难'
    const cls =
        difficulty === 'easy'
            ? 'bg-easy-weak text-easy'
            : difficulty === 'medium'
                ? 'bg-medium-weak text-medium'
                : 'bg-hard-weak text-hard'
    return <span className={`flex-none rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
}

/** 行式目录条目:题号(mono,可引用的索引数据)+ 标题 + 摘要 + 状态行 */
export function QuestionRow({ q, index }: { q: QuestionListItem; index?: number }) {
    return (
        <a
            href={`/question/${q.slug}`}
            className="group -mx-2 block rounded-lg border-b border-border px-2 py-4 transition-colors last:border-b-0 hover:bg-card"
        >
            <h3 className="m-0 flex items-baseline gap-3 text-[15.5px] font-semibold leading-snug">
                {index !== undefined ? (
                    <span className="min-w-7 flex-none text-right font-mono text-xs font-normal text-muted-foreground">
                        {String(index).padStart(2, '0')}
                    </span>
                ) : null}
                <span className="min-w-0 transition-colors group-hover:text-accent">{q.title}</span>
                <DiffBadge difficulty={q.difficulty} />
            </h3>
            {q.summary ? (
                <p className="mx-0 mt-1 line-clamp-2 text-[13.5px] text-muted-foreground">{q.summary}</p>
            ) : null}
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{q.viewCount} 次浏览</span>
                {q.tags?.slice(0, 3).map((t) => (
                    <span key={t} className="rounded-full border border-border px-2 py-px text-muted-foreground">
                        {t}
                    </span>
                ))}
            </div>
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
        <a href={href} className="group -mx-2 block rounded-lg border-b border-border px-2 py-4 transition-colors last:border-b-0 hover:bg-card">
            <h3 className="m-0 flex items-baseline gap-3 text-[15.5px] font-semibold leading-snug">
                <span className="min-w-0 transition-colors group-hover:text-accent">{title}</span>
                {badge}
            </h3>
            {desc ? <p className="mt-1 text-[13.5px] text-muted-foreground">{desc}</p> : null}
            {meta ? <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{meta}</div> : null}
        </a>
    )
}
