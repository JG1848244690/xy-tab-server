import type { Metadata } from 'next'
import { QuestionRow, DiffBadge } from '@/components/rows'
import { siteApi } from '@/lib/site-api'

export const metadata: Metadata = {
    alternates: { canonical: '/' },
}

export default async function HomePage() {
    // 取两页算难度分布(构建期静态算好;>500 题后换专用聚合接口)
    const [p1, p2, banks, tags] = await Promise.all([
        siteApi.questions({ size: 50 }),
        siteApi.questions({ size: 50, page: 2 }),
        siteApi.banks(),
        siteApi.tags(),
    ])
    const all = [...p1.data, ...p2.data]
    const byDiff = {
        easy: all.filter((q) => q.difficulty === 'easy').length,
        medium: all.filter((q) => q.difficulty === 'medium').length,
        hard: all.filter((q) => q.difficulty === 'hard').length,
    }
    const maxDiff = Math.max(byDiff.easy, byDiff.medium, byDiff.hard, 1)

    const featured = hot(p1.data)
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
                        共 <strong>{p1.total}</strong> 道题
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

            <div className="section-head">
                <h2>难度分布</h2>
            </div>
            <div className="dist">
                <div className="dist-row">
                    <span className="diff diff-easy">简单</span>
                    <span className="bar">
                        <i style={{ width: `${(byDiff.easy / maxDiff) * 100}%`, background: 'var(--easy)' }} />
                    </span>
                    <span className="n">{byDiff.easy}</span>
                </div>
                <div className="dist-row">
                    <span className="diff diff-medium">中等</span>
                    <span className="bar">
                        <i style={{ width: `${(byDiff.medium / maxDiff) * 100}%`, background: 'var(--medium)' }} />
                    </span>
                    <span className="n">{byDiff.medium}</span>
                </div>
                <div className="dist-row">
                    <span className="diff diff-hard">困难</span>
                    <span className="bar">
                        <i style={{ width: `${(byDiff.hard / maxDiff) * 100}%`, background: 'var(--hard)' }} />
                    </span>
                    <span className="n">{byDiff.hard}</span>
                </div>
            </div>

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
                <h2>建议的复习节奏</h2>
            </div>
            <div className="howto">
                <div className="step">
                    <b>
                        <span className="no">1</span>先自己说答案
                    </b>
                    <p>只看题目,口头作答,再对照分层解析找差距。最痛苦的一遍,涨分最快。</p>
                </div>
                <div className="step">
                    <b>
                        <span className="no">2</span>口诀巩固骨架
                    </b>
                    <p>第二遍只看一句话结论和记忆口诀,把答案的骨架焊牢。</p>
                </div>
                <div className="step">
                    <b>
                        <span className="no">3</span>串成网
                    </b>
                    <p>考前用题目页底部的「相关题目」顺藤摸瓜,把同主题的题连成网络。</p>
                </div>
            </div>

            <div className="section-head">
                <h2>最新题目</h2>
            </div>
            <div className="list">
                {p1.data.map((q, i) => (
                    <QuestionRow key={q.slug} q={q} index={i + 1} />
                ))}
            </div>
        </>
    )
}

function hot(data: Awaited<ReturnType<typeof siteApi.questions>>['data']) {
    // 今日一题:取浏览量最高的一道(数据真实,构建期确定)
    return [...data].sort((a, b) => b.viewCount - a.viewCount)[0]
}
