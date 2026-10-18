import type { QuestionListItem } from '@/lib/site-api'

/** 难度徽标:颜色只编码状态 */
export function DiffBadge({ difficulty }: { difficulty: QuestionListItem['difficulty'] }) {
    const label = difficulty === 'easy' ? '简单' : difficulty === 'medium' ? '中等' : '困难'
    return <span className={`diff diff-${difficulty}`}>{label}</span>
}

/** 行式目录条目:序号 + 标题 + 摘要 + 状态行(工程阅读型,非卡片橱窗) */
export function QuestionRow({ q, index }: { q: QuestionListItem; index?: number }) {
    return (
        <a href={`/question/${q.slug}`} className="row">
            <h3>
                {index !== undefined ? (
                    <span className="row-idx">{String(index).padStart(2, '0')}</span>
                ) : null}
                <span className="row-title">{q.title}</span>
                <DiffBadge difficulty={q.difficulty} />
            </h3>
            {q.summary ? <p>{q.summary}</p> : null}
            <div className="meta-row">
                <span>{q.viewCount} 次浏览</span>
                {q.tags?.slice(0, 3).map((t) => (
                    <span key={t} className="pill">
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
        <a href={href} className="row">
            <h3>
                <span className="row-title">{title}</span>
                {badge}
            </h3>
            {desc ? <p>{desc}</p> : null}
            {meta ? <div className="meta-row">{meta}</div> : null}
        </a>
    )
}
