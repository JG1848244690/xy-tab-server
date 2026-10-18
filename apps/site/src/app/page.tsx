import Link from 'next/link'
import type { Metadata } from 'next'
import { QuestionCard } from '@/components/question-card'
import { siteApi } from '@/lib/site-api'
import { track } from '@/lib/track'

export const metadata: Metadata = {
    alternates: { canonical: '/' },
}

export default async function HomePage() {
    const [hot, banks, tags] = await Promise.all([
        siteApi.questions({ size: 10 }),
        siteApi.banks(),
        siteApi.tags(),
    ])

    return (
        <>
            <h1 className="page-title">前端 / 算法面试题,每题都有人工复核的分层解析</h1>
            <p style={{ color: 'var(--muted)' }}>
                AI + 人工双审徽章 · 免费 · 不藏要点。适合面试前突击与日常复习。
            </p>

            <div className="section-head">
                <h2>题库入口</h2>
                <Link href="/banks">全部题库 →</Link>
            </div>
            <div className="tag-cloud">
                {banks.data.length ? (
                    banks.data.slice(0, 8).map((b) => (
                        <Link key={b.slug} href={`/bank/${b.slug}`} className="card">
                            <h3>{b.title}</h3>
                            <p>{b.questionCount} 题</p>
                        </Link>
                    ))
                ) : (
                    <span className="empty">题库整理中</span>
                )}
            </div>

            {tags.data.length ? (
                <>
                    <div className="section-head">
                        <h2>按标签复习</h2>
                    </div>
                    <div className="tag-cloud">
                        {tags.data
                            .filter((t) => t.questionCount > 0)
                            .slice(0, 10)
                            .map((t) => (
                                <Link key={t.slug} href={`/tag/${t.slug}`} className="card">
                                    {t.name} · {t.questionCount}
                                </Link>
                            ))}
                    </div>
                </>
            ) : null}

            <div className="section-head">
                <h2>热门题目</h2>
            </div>
            {hot.data.length ? (
                hot.data.map((q) => <QuestionCard key={q.slug} q={q} />)
            ) : (
                <div className="empty">内容马上就来</div>
            )}
        </>
    )
}
