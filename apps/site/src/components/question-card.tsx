import Link from 'next/link'
import type { QuestionListItem } from '@/lib/site-api'

/** 难度/日期/浏览量的一行小字 */
export function MetaRow({ q }: { q: QuestionListItem }) {
    return (
        <div className="meta-row">
            <span className={`difficulty-${q.difficulty}`}>
                {q.difficulty === 'easy' ? '简单' : q.difficulty === 'medium' ? '中等' : '困难'}
            </span>
            {q.publishedAt ? <span>{q.publishedAt.slice(0, 10)}</span> : null}
            <span>{q.viewCount} 次浏览</span>
            {q.tags?.slice(0, 4).map((t) => (
                <span key={t} className="pill">
                    {t}
                </span>
            ))}
        </div>
    )
}

export function QuestionCard({ q }: { q: QuestionListItem }) {
    return (
        <Link href={`/question/${q.slug}`} className="card" style={{ display: 'block' }}>
            <h3>{q.title}</h3>
            <p>{q.summary ?? '点击查看题干与分层解析。'}</p>
            <MetaRow q={q} />
        </Link>
    )
}
