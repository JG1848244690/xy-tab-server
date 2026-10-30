import type { Metadata } from 'next'
import { QuestionRow, DiffBadge } from '@/components/rows'
import { siteApi } from '@/lib/site-api'
import { FEATURED_SLUGS, FEATURED_BLURBS } from '@/lib/featured'

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://hls.kskbl.com.cn'

export const metadata: Metadata = {
    alternates: { canonical: '/' },
}

const CAT_COLORS = ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)']

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

    // 人工精选池:每天轮换一道;详情接口失败时跳过,不让首页挂掉
    const featuredPool = (
        await Promise.all(
            FEATURED_SLUGS.map((slug) => siteApi.question(slug).catch(() => null)),
        )
    ).filter((q): q is NonNullable<typeof q> => Boolean(q))
    const todayIndex = featuredPool.length
        ? Math.floor(Date.now() / 86_400_000) % featuredPool.length
        : 0
    const featured = featuredPool[todayIndex] ?? null
    const activeTags = tags.data
        .filter((t) => t.questionCount > 0 && t.kind !== 'legacy')
        .filter((t) => t.kind === 'point')
        .slice(0, 14)

    return (
        <>
            {/* 扉页:页边注 + 标题 + 今日一题摘录 */}
            <section className="grid gap-10 pb-12 pt-4 lg:grid-cols-[56px_minmax(0,1fr)_350px] lg:gap-12">
                <aside className="hidden select-none flex-col justify-between border-r border-border/70 pr-4 lg:flex">
                    <span className="rail text-muted-foreground">序言 · 二〇二六</span>
                    <span className="rail font-mono text-[10px] text-muted-foreground">
                        {p1.total} 题
                    </span>
                </aside>

                <div>
                    <p className="text-[11px] tracking-[0.18em] text-muted-foreground">
                        免费 · Web 开发面试题库
                    </p>
                    <h1 className="mt-4 text-balance font-serif text-[40px] leading-[1.14] tracking-[-0.03em] sm:text-[56px]">
                        面试题,
                        <br />
                        按原理分层讲透
                    </h1>
                    <p className="mt-5 max-w-[44ch] text-[15px] leading-7 text-muted-foreground">
                        每道题都有结论、原理和边界。像翻书一样,从目录找到你卡住的那一页。
                    </p>

                    <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-2 border-t border-border pt-4 text-[13px]">
                        <div className="flex items-baseline gap-2">
                            <dt className="text-muted-foreground">题目</dt>
                            <dd className="font-serif text-[19px] leading-none">{p1.total}</dd>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <dt className="text-muted-foreground">题库</dt>
                            <dd className="font-serif text-[19px] leading-none">{banks.data.length}</dd>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <dt className="text-muted-foreground">更新</dt>
                            <dd className="font-mono text-[12px]">2026.10</dd>
                        </div>
                    </dl>
                </div>

                {featured ? (
                    <a
                        href={`/question/${featured.slug}`}
                        className="group relative flex flex-col self-center border border-border bg-card p-5 transition-colors hover:border-foreground/35"
                    >
                        <div className="flex items-baseline justify-between text-[11px] tracking-[0.14em] text-muted-foreground">
                            <span>今日一题</span>
                            <span className="font-mono">
                                精选 {String(todayIndex + 1).padStart(2, '0')}/{String(featuredPool.length).padStart(2, '0')}
                            </span>
                        </div>
                        <h2 className="mt-3 font-serif text-[22px] leading-[1.35] tracking-[-0.01em]">
                            {featured.title}
                        </h2>
                        <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-muted-foreground">
                            {FEATURED_BLURBS[featured.slug] ?? featured.summary ?? '点击查看题干与分层解析。'}
                        </p>
                        <div className="mt-auto flex items-end justify-between pt-5">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                <DiffBadge difficulty={featured.difficulty} />
                                {featured.direction ? <span>{featured.direction}</span> : null}
                                {featured.techStack ? <span>/ {featured.techStack}</span> : null}
                            </div>
                            <span className="text-[12px] text-accent transition-transform duration-300 group-hover:translate-x-0.5">
                                阅读 →
                            </span>
                        </div>
                    </a>
                ) : null}
            </section>

            {/* 贡献:一条安静的编者按,不再用实心按钮抢焦点 */}
            <section className="flex flex-col gap-3 border-y border-border py-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-[62ch] text-[13.5px] leading-6 text-muted-foreground">
                    <span className="font-serif text-[15px] text-foreground">众人拾柴火焰高。</span>
                    分享一道你真实遇到的面试题,或补充、纠正现有答案。
                </p>
                <a
                    href={`${WEB_URL}/test-center`}
                    className="seal-link flex flex-none items-center gap-2 text-[13.5px] text-foreground transition-colors hover:text-seal"
                >
                    贡献一道题
                    <span className="seal" aria-hidden>
                        献
                    </span>
                </a>
            </section>

            {/* 编辑精选:人工 seed,首屏第一眼看到的必须是能打的题 */}
            {featuredPool.length ? (
                <section className="mt-12">
                    <div className="flex items-baseline justify-between border-b border-foreground/80 pb-2">
                        <h2 className="font-serif text-[15px] tracking-[0.04em]">编辑精选</h2>
                        <span className="text-[12px] text-muted-foreground">十道值得先读的题</span>
                    </div>
                    <div className="mt-1 grid gap-x-10 sm:grid-cols-2">
                        {featuredPool.map((q, i) => (
                            <a
                                key={q.slug}
                                href={`/question/${q.slug}`}
                                className="group flex items-baseline gap-3 border-b border-border py-3"
                            >
                                <span
                                    className="w-5 flex-none font-mono text-[10.5px]"
                                    style={{ color: CAT_COLORS[i % CAT_COLORS.length] }}
                                >
                                    {String(i + 1).padStart(2, '0')}
                                </span>
                                <span className="title-underline min-w-0 flex-1 font-serif text-[15.5px] leading-snug transition-colors group-hover:text-accent">
                                    {q.title}
                                </span>
                                <span className="hidden flex-none font-mono text-[10px] text-muted-foreground sm:inline">
                                    {q.techStack}
                                </span>
                                <DiffBadge difficulty={q.difficulty} />
                            </a>
                        ))}
                    </div>
                </section>
            ) : null}

            {/* 目录:书页式点线引导 */}
            {banks.data.length ? (
                <section className="mt-12">
                    <div className="flex items-baseline justify-between border-b border-foreground/80 pb-2">
                        <h2 className="font-serif text-[15px] tracking-[0.04em]">目录</h2>
                        <a href="/banks" className="text-[12px] text-muted-foreground transition-colors hover:text-accent">
                            全部题库
                        </a>
                    </div>
                    <div>
                        {banks.data.map((b, i) => (
                            <a
                                key={b.slug}
                                href={`/bank/${b.slug}`}
                                className="group flex items-baseline gap-4 border-b border-border py-4"
                            >
                                <span
                                    className="w-6 flex-none font-mono text-[11px]"
                                    style={{ color: CAT_COLORS[i % CAT_COLORS.length] }}
                                >
                                    {String(i + 1).padStart(2, '0')}
                                </span>
                                <span className="title-underline font-serif text-[19px] leading-snug transition-colors group-hover:text-accent">
                                    {b.title}
                                </span>
                                <span className="leader" />
                                <span className="flex-none font-mono text-[11px] text-muted-foreground">
                                    {b.questionCount}
                                </span>
                            </a>
                        ))}
                    </div>
                </section>
            ) : null}

            {/* 分布 + 标签索引 */}
            <section className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
                <div>
                    <h2 className="border-b border-foreground/80 pb-2 font-serif text-[15px] tracking-[0.04em]">
                        难度分布
                    </h2>
                    <div className="mt-4 space-y-3">
                        {(
                            [
                                ['简单', 'easy'],
                                ['中等', 'medium'],
                                ['困难', 'hard'],
                            ] as const
                        ).map(([label, key]) => (
                            <div
                                key={key}
                                className="grid grid-cols-[40px_1fr_28px] items-center gap-3 text-[12px]"
                            >
                                <span className="text-muted-foreground">{label}</span>
                                <span className="h-1.5 overflow-hidden bg-muted">
                                    <span
                                        className="bar-fill block h-full"
                                        style={{
                                            width: `${(byDiff[key] / maxDiff) * 100}%`,
                                            background: `var(--${key})`,
                                            animationDelay: `${
                                                key === 'easy' ? 80 : key === 'medium' ? 180 : 280
                                            }ms`,
                                        }}
                                    />
                                </span>
                                <span className="text-right font-mono text-[11px] text-muted-foreground">
                                    {byDiff[key]}
                                </span>
                            </div>
                        ))}
                    </div>
                    <p className="mt-4 text-[12px] leading-5 text-muted-foreground">
                        按已发布题目统计,持续更新。
                    </p>
                </div>

                {activeTags.length > 0 ? (
                    <div>
                        <div className="flex items-baseline justify-between border-b border-foreground/80 pb-2">
                            <h2 className="font-serif text-[15px] tracking-[0.04em]">按标签找题</h2>
                            <a href="/tags" className="text-[12px] text-muted-foreground transition-colors hover:text-accent">
                                全部标签
                            </a>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                            {activeTags.map((t) => (
                                <a
                                    key={t.slug}
                                    href={`/tag/${t.slug}`}
                                    className="border-b border-transparent text-[13.5px] text-foreground/85 transition-colors hover:border-seal hover:text-seal"
                                >
                                    {t.name}
                                    <sup className="ml-1 font-mono text-[10px] text-muted-foreground">
                                        {t.questionCount}
                                    </sup>
                                </a>
                            ))}
                        </div>
                    </div>
                ) : null}
            </section>

            {/* 复习节奏:书页注脚,不做卡片 */}
            <section className="mt-12">
                <h2 className="border-b border-foreground/80 pb-2 font-serif text-[15px] tracking-[0.04em]">
                    建议的复习节奏
                </h2>
                <div className="grid gap-8 pt-5 md:grid-cols-3">
                    {(
                        [
                            ['一', '先自己说答案', '只看题目,口头作答,再对照分层解析找差距。最痛苦的一遍,涨分最快。'],
                            ['二', '口诀巩固骨架', '第二遍只看一句话结论和记忆口诀,把答案的骨架焊牢。'],
                            ['三', '串成网', '考前用题目页底部的相关题目顺藤摸瓜,把同主题的题连成网络。'],
                        ] as const
                    ).map(([no, title, desc]) => (
                        <div key={no} className="border-t border-border pt-3">
                            <b className="flex items-baseline gap-3 font-serif text-[15px]">
                                <span className="text-[18px] text-seal">{no}</span>
                                {title}
                            </b>
                            <p className="mt-1.5 text-[13px] leading-6 text-muted-foreground">{desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="mt-12">
                <div className="flex items-baseline justify-between border-b border-foreground/80 pb-2">
                    <h2 className="font-serif text-[15px] tracking-[0.04em]">最近更新</h2>
                    <a href="/banks" className="text-[12px] text-muted-foreground transition-colors hover:text-accent">
                        按题库浏览
                    </a>
                </div>
                <div>
                    {p1.data.slice(0, 8).map((q, i) => (
                        <QuestionRow key={q.slug} q={q} index={i + 1} />
                    ))}
                </div>
            </section>
        </>
    )
}
