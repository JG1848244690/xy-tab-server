import type { Metadata } from 'next'
import { QuestionRow, DiffBadge } from '@/components/rows'
import { siteApi } from '@/lib/site-api'

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://hls.kskbl.com.cn'

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

    const featured = [...p1.data].sort((a, b) => b.viewCount - a.viewCount)[0]
    const activeTags = tags.data.filter((t) => t.questionCount > 0 && t.kind !== 'legacy')

    return (
        <>
            {/* hero:左文案 + 右今日一题(产品自证);移动端纵排 */}
            <section className="relative isolate grid items-center gap-10 py-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-14">
                <div className="hero-glow" aria-hidden />
                <div>
                    <h1 className="text-balance text-[32px] font-bold leading-[1.2] tracking-[-0.028em] sm:text-4xl">
                        面试题,按原理分层讲透
                    </h1>
                    <p
                        className="rise mt-4 max-w-[52ch] text-base text-muted-foreground"
                        style={{ animationDelay: '90ms' }}
                    >
                        每道题都有 AI + 人工双审的分层参考答案、一句话结论与记忆口诀。
                        免费开放,不藏要点。
                    </p>
                    <div
                        className="rise mt-5 flex flex-wrap items-center gap-2.5 text-[13.5px] text-muted-foreground"
                        style={{ animationDelay: '170ms' }}
                    >
                        <span className="rounded-full border border-border bg-card px-3 py-1">
                            <b className="font-semibold text-foreground">{p1.total}</b> 道题
                        </span>
                        <span className="rounded-full border border-border bg-card px-3 py-1">
                            <b className="font-semibold text-foreground">{banks.data.length}</b> 个专题题库
                        </span>
                        <span className="rounded-full border border-border bg-card px-3 py-1">
                            持续更新
                        </span>
                    </div>
                </div>

                {featured ? (
                    <a
                        href={`/question/${featured.slug}`}
                        className="rise lift group block rounded-2xl border border-border bg-card p-6 shadow-[0_2px_4px_rgb(16_24_40/0.04),0_12px_32px_rgb(16_24_40/0.08)] hover:border-accent lg:mt-0"
                        style={{ animationDelay: '240ms' }}
                    >
                        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                            <span>今日一题</span>
                            <span className="arrow-nudge">→</span>
                        </div>
                        <h2 className="mb-1.5 text-lg font-semibold leading-snug tracking-[-0.01em]">
                            {featured.title}
                        </h2>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                            {featured.summary ?? '点击查看题干与分层解析。'}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <DiffBadge difficulty={featured.difficulty} />
                            {[featured.direction, featured.techStack, ...(featured.knowledgePoints ?? [])]
                                .filter(Boolean)
                                .slice(0, 3)
                                .map((t) => (
                                    <span key={t} className="rounded-full border border-border px-2 py-px">
                                        {t}
                                    </span>
                                ))}
                        </div>
                    </a>
                ) : null}
            </section>

            {/* 社区贡献入口:平台是共享题库,鼓励大家补充/纠错 */}
            <section className="mt-8 rounded-2xl border border-accent/30 bg-accent/5 p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
                <div>
                    <h2 className="text-[16px] font-semibold tracking-[-0.01em]">众人拾柴火焰高</h2>
                    <p className="mt-1 max-w-[64ch] text-[13.5px] leading-relaxed text-muted-foreground">
                        分享一道你真实遇到的面试题,或补充/纠正现有答案。被审核采纳后,题目会出现在这里,
                        帮助下一个准备面试的人。
                    </p>
                </div>
                <a
                    href={`${WEB_URL}/test-center`}
                    className="mt-3 inline-block shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 sm:mt-0"
                >
                    贡献一道题 →
                </a>
            </section>

            {banks.data.length ? (
                <>
                    <div className="mt-10 mb-2 flex items-baseline justify-between">
                        <h2 className="text-base font-semibold tracking-[-0.01em]">题库</h2>
                        <a href="/banks" className="text-[13px] text-accent">全部 →</a>
                    </div>
                    <div className="border-t border-border">
                        {banks.data.map((b) => (
                            <a
                                key={b.slug}
                                href={`/bank/${b.slug}`}
                                className="group -mx-2 block rounded-lg border-b border-border px-2 py-4 transition-colors hover:bg-card"
                            >
                                <h3 className="flex items-baseline gap-3 text-[15.5px] font-semibold leading-snug">
                                    <span className="title-underline min-w-0 group-hover:text-accent">{b.title}</span>
                                    <span className="flex-none rounded-full bg-easy-weak px-2.5 py-0.5 text-xs font-medium text-easy">
                                        {b.questionCount} 题
                                    </span>
                                </h3>
                                {b.description ? (
                                    <p className="mt-1 text-[13.5px] text-muted-foreground">{b.description}</p>
                                ) : null}
                            </a>
                        ))}
                    </div>
                </>
            ) : null}

            {/* 难度分布:构建期真实数据,纯 CSS 条形 */}
            <div className="mt-10 mb-2">
                <h2 className="text-base font-semibold tracking-[-0.01em]">难度分布</h2>
            </div>
            <div className="max-w-[560px] rounded-xl border border-border bg-card p-5">
                {(
                    [
                        ['简单', 'easy'],
                        ['中等', 'medium'],
                        ['困难', 'hard'],
                    ] as const
                ).map(([label, key]) => (
                    <div key={key} className="grid grid-cols-[44px_1fr_36px] items-center gap-3 py-1.5 text-[13px]">
                        <span
                            className={`rounded-full px-2.5 py-0.5 text-center text-xs font-medium ${
                                key === 'easy'
                                    ? 'bg-easy-weak text-easy'
                                    : key === 'medium'
                                        ? 'bg-medium-weak text-medium'
                                        : 'bg-hard-weak text-hard'
                            }`}
                        >
                            {label}
                        </span>
                        <span className="h-2 overflow-hidden rounded-full bg-muted">
                            <span
                                className="bar-fill block h-full rounded-full"
                                style={{
                                    width: `${(byDiff[key] / maxDiff) * 100}%`,
                                    background: `var(--${key})`,
                                    animationDelay: `${key === 'easy' ? 80 : key === 'medium' ? 180 : 280}ms`,
                                }}
                            />
                        </span>
                        <span className="text-right font-mono text-muted-foreground">{byDiff[key]}</span>
                    </div>
                ))}
            </div>

            {activeTags.length > 0 ? (
                <>
                    <div className="mt-10 mb-3 flex items-baseline justify-between">
                        <h2 className="text-base font-semibold tracking-[-0.01em]">按标签复习</h2>
                        <a href="/tags" className="text-[13px] text-accent">全部 →</a>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {activeTags.slice(0, 12).map((t) => (
                            <a
                                key={t.slug}
                                href={`/tag/${t.slug}`}
                                className="rounded-full border border-border bg-card px-4 py-1.5 text-[13.5px] text-foreground/85 transition-colors hover:border-accent hover:text-accent"
                            >
                                {t.name}
                                <small className="ml-1.5 font-mono text-muted-foreground">{t.questionCount}</small>
                            </a>
                        ))}
                    </div>
                </>
            ) : null}

            <div className="mt-10 mb-3">
                <h2 className="text-base font-semibold tracking-[-0.01em]">建议的复习节奏</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
                {(
                    [
                        ['1', '先自己说答案', '只看题目,口头作答,再对照分层解析找差距。最痛苦的一遍,涨分最快。'],
                        ['2', '口诀巩固骨架', '第二遍只看一句话结论和记忆口诀,把答案的骨架焊牢。'],
                        ['3', '串成网', '考前用题目页底部的「相关题目」顺藤摸瓜,把同主题的题连成网络。'],
                    ] as const
                ).map(([no, title, desc]) => (
                    <div key={no} className="lift rounded-xl border border-border bg-card p-4">
                        <b className="mb-1 flex items-baseline gap-2 text-[14.5px]">
                            <span className="font-mono font-semibold text-accent">{no}</span>
                            {title}
                        </b>
                        <p className="m-0 text-[13.5px] leading-relaxed text-muted-foreground">{desc}</p>
                    </div>
                ))}
            </div>

            <div className="mt-10 mb-2 flex items-baseline justify-between">
                <h2 className="text-base font-semibold tracking-[-0.01em]">最新题目</h2>
            </div>
            <div className="border-t border-border">
                {p1.data.map((q, i) => (
                    <QuestionRow key={q.slug} q={q} index={i + 1} />
                ))}
            </div>
        </>
    )
}
