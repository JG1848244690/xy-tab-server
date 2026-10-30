import type { Metadata } from 'next'
import { siteApi } from '@/lib/site-api'

export const metadata: Metadata = {
    title: '全部题库',
    description: '按专题组织的面试题库合集,覆盖前端、算法与工程实践。',
    alternates: { canonical: '/banks' },
}

const CAT = ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)']

export default async function BanksPage() {
    const banks = await siteApi.banks()

    return (
        <>
            <h1 className="text-balance font-serif text-[32px] leading-tight tracking-[-0.025em]">
                题库
            </h1>
            <p className="mt-2 mb-10 max-w-[58ch] text-[14px] leading-6 text-muted-foreground">
                按专题组织。每道题都经过审核链,才会出现在这里。
            </p>
            {banks.data.length ? (
                <div className="border-t border-foreground/80">
                    {banks.data.map((b, i) => (
                        <a
                            key={b.slug}
                            href={`/bank/${b.slug}`}
                            className="group flex items-baseline gap-5 border-b border-border py-5"
                        >
                            <span
                                className="hidden w-6 flex-none font-mono text-[11px] sm:block"
                                style={{ color: CAT[i % CAT.length] }}
                            >
                                {String(i + 1).padStart(2, '0')}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="title-underline font-serif text-[20px] leading-snug transition-colors group-hover:text-accent">
                                    {b.title}
                                </span>
                                {b.description ? (
                                    <span className="mt-1 block text-[12.5px] leading-5 text-muted-foreground">
                                        {b.description}
                                    </span>
                                ) : null}
                            </span>
                            <span className="flex flex-none items-baseline gap-3 font-mono text-[10.5px] text-muted-foreground">
                                {b.questionCount} 题
                                <span className="transition-transform duration-300 group-hover:translate-x-0.5">
                                    →
                                </span>
                            </span>
                        </a>
                    ))}
                </div>
            ) : (
                <div className="border border-dashed border-border bg-card p-14 text-center text-sm text-muted-foreground">
                    题库整理中,先看看首页的最新题目
                </div>
            )}
        </>
    )
}
