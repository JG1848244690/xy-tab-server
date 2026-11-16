import { ArrowUpRight, PenLine, ShieldCheck, Signature } from 'lucide-react'

/** 主站(后台 SPA)地址:投稿入口在 test-center */
const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://hls.kskbl.com.cn'
const CONTRIBUTE_URL = `${WEB_URL}/test-center`

/**
 * 站内投稿引导。
 *
 * 目的很单纯:前台是「读」的地方,主站是「写」的地方,
 * 两边的桥必须显眼。之前只有页头一个灰色文字链接,几乎没人点。
 *
 * 两种形态:
 *   ContributeBand    —— 题目/文章正文末尾,读完那一刻的转化位
 *   ContributeSection —— 首页区块,把「投稿 → 审核 → 署名」讲清楚
 */

export function ContributeBand({ topic }: { topic?: string }) {
    return (
        <section className="relative mt-12 overflow-hidden border border-border bg-card">
            {/* 朱砂竖条:和站内其它「书页边注」的视觉语言一致 */}
            <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-seal" />

            <div className="grid gap-5 py-5 pl-6 pr-5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-8 sm:py-6 sm:pl-7 sm:pr-6">
                <div className="min-w-0">
                    <p className="font-mono text-[10px] tracking-[0.18em] text-seal">CONTRIBUTE</p>
                    <h2 className="mt-1.5 font-serif text-[17px] leading-snug tracking-tight">
                        这道题,还能讲得更好
                    </h2>
                    <p className="mt-1.5 text-[12.5px] leading-6 text-muted-foreground">
                        {topic ? (
                            <>
                                觉得「<span className="text-foreground/80">{topic.slice(0, 18)}</span>」的答案有遗漏或错误?
                            </>
                        ) : null}
                        补充原理、纠正错误,或者贡献一道你自己的题 —— 审核通过后会署上名字。
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                    <a
                        href={CONTRIBUTE_URL}
                        rel="nofollow noopener noreferrer"
                        target="_blank"
                        className="group inline-flex items-center gap-2 bg-seal px-4 py-2.5 text-[13px] text-white transition-colors hover:bg-seal/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seal"
                    >
                        <PenLine className="size-3.5" aria-hidden />
                        去投稿
                        <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5">
                            →
                        </span>
                    </a>
                    <a
                        href={`${WEB_URL}/test-center`}
                        rel="nofollow noopener noreferrer"
                        target="_blank"
                        className="text-[12px] text-muted-foreground transition-colors hover:text-seal"
                    >
                        先看看别人怎么写的 ↗
                    </a>
                </div>
            </div>
        </section>
    )
}

const STEPS = [
    { icon: PenLine, title: '投稿', desc: '在主站写下题目和你的答案,不用排版。' },
    { icon: ShieldCheck, title: '审核', desc: 'AI 先做结构化检查,再由人判断够不够格。' },
    { icon: Signature, title: '署名', desc: '通过后出现在这里,带上你的名字和日期。' },
] as const

export function ContributeSection({ total }: { total: number }) {
    return (
        <section className="mt-14 border-t border-foreground/80 pt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-serif text-[15px] tracking-[0.04em]">这座书架,你也可以加一本</h2>
                <span className="font-mono text-[11px] text-muted-foreground">
                    当前 {total} 个知识点 · 全部免费
                </span>
            </div>

            <div className="mt-5 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-3">
                {STEPS.map((s, i) => (
                    <div key={s.title} className="group relative bg-card p-5 transition-colors hover:bg-muted/40">
                        <span className="absolute right-4 top-3 font-mono text-[11px] text-muted-foreground/60">
                            0{i + 1}
                        </span>
                        <s.icon className="size-4 text-seal" aria-hidden />
                        <p className="mt-3 font-serif text-[14.5px]">{s.title}</p>
                        <p className="mt-1 text-[12.5px] leading-6 text-muted-foreground">{s.desc}</p>
                    </div>
                ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
                <a
                    href={CONTRIBUTE_URL}
                    rel="nofollow noopener noreferrer"
                    target="_blank"
                    className="group inline-flex items-center gap-2 bg-seal px-4 py-2.5 text-[13px] text-white transition-colors hover:bg-seal/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seal"
                >
                    <PenLine className="size-3.5" aria-hidden />
                    贡献一道题
                    <ArrowUpRight className="size-3.5 transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                </a>
                <a href="/articles" className="text-[12.5px] text-muted-foreground transition-colors hover:text-accent">
                    也可以先读读别人写的
                </a>
            </div>
        </section>
    )
}
