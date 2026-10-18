import type { Metadata } from 'next'
import { QuestionRow, DiffBadge } from '@/components/rows'
import { siteApi } from '@/lib/site-api'

export const metadata: Metadata = {
    alternates: { canonical: '/' },
}

export default async function HomePage() {
    const [hot, banks, tags] = await Promise.all([
        siteApi.questions({ size: 10 }),
        siteApi.banks(),
        siteApi.tags(),
    ])

    const featured = hot.data[0]
    const activeTags = tags.data.filter((t) => t.questionCount > 0)

    return (
        <>
            <section className="hero">
                <h1>面试题,按原理分层讲透</h1>
                <p>
                    每道题都有 AI + 人工双审的分层参考答案、一句话结论与记忆口诀。
                    免费开放,不藏要点。
                </p>
                <div className="hero-line">
                    <span>
                        共 <strong>{hot.total}</strong> 道题
                    </span>
                    <span>·</span>
                    <span>
                        <strong>{banks.data.length}</strong> 个专题题库
                    </span>
                    <span>·</span>
                    <span>持续更新</span>
                </div>

                {featured ? (
                    <a href={`/question/${featured.slug}`} className="featured">
                        <div className="f-label">今日一题</div>
                        <h2 className="f-title">{featured.title}</h2>
                        <p>{featured.summary ?? '点击查看题干与分层解析。'}</p>
                        <div className="meta-row">
                            <DiffBadge difficulty={featured.difficulty} />
                            {featured.tags?.slice(0, 3).map((t) => (
                                <span key={t} className="pill">
                                    {t}
                                </span>
                            ))}
                        </div>
                    </a>
                ) : null}
            </section>

            {banks.data.length ? (
                <>
                    <div className="section-head">
                        <h2>题库</h2>
                        <a href="/banks">全部 →</a>
                    </div>
                    <div className="list">
                        {banks.data.map((b) => (
                            <a key={b.slug} href={`/bank/${b.slug}`} className="row">
                                <h3>
                                    <span className="row-title">{b.title}</span>
                                    <span className="diff diff-easy">{b.questionCount} 题</span>
                                </h3>
                                {b.description ? <p>{b.description}</p> : null}
                            </a>
                        ))}
                    </div>
                </>
            ) : null}

            {activeTags.length > 0 ? (
                <>
                    <div className="section-head">
                        <h2>按标签复习</h2>
                        <a href="/tags">全部 →</a>
                    </div>
                    <div className="tag-cloud">
                        {activeTags.slice(0, 12).map((t) => (
                            <a key={t.slug} href={`/tag/${t.slug}`}>
                                {t.name}
                                <small>{t.questionCount}</small>
                            </a>
                        ))}
                    </div>
                </>
            ) : null}

            <div className="section-head">
                <h2>最新题目</h2>
            </div>
            <div className="list">
                {hot.data.map((q, i) => (
                    <QuestionRow key={q.slug} q={q} index={i + 1} />
                ))}
            </div>
        </>
    )
}
