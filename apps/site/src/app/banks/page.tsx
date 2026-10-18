import type { Metadata } from 'next'
import { ListRow } from '@/components/rows'
import { siteApi } from '@/lib/site-api'

export const metadata: Metadata = {
    title: '全部题库',
    description: '按专题组织的面试题库合集,覆盖前端、算法与工程实践。',
    alternates: { canonical: '/banks' },
}

export default async function BanksPage() {
    const banks = await siteApi.banks()

    return (
        <>
            <h1 className="page-title">题库</h1>
            <p className="page-sub">按专题组织,每道题都经过审核链才能出现在这里。</p>
            {banks.data.length ? (
                <div className="list">
                    {banks.data.map((b) => (
                        <ListRow
                            key={b.slug}
                            href={`/bank/${b.slug}`}
                            title={b.title}
                            desc={b.description}
                            badge={<span className="diff diff-easy">{b.questionCount} 题</span>}
                        />
                    ))}
                </div>
            ) : (
                <div className="empty">题库整理中,先看看首页的最新题目</div>
            )}
        </>
    )
}
