import type { Metadata } from 'next'
import { QuestionCard } from '@/components/question-card'
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
            {banks.data.length ? (
                banks.data.map((b) => (
                    <a key={b.slug} href={`/bank/${b.slug}`} className="card" style={{ display: 'block' }}>
                        <h3>{b.title}</h3>
                        <p>{b.description ?? `${b.questionCount} 道已发布题目`}</p>
                        <div className="meta-row">
                            <span className="pill">{b.questionCount} 题</span>
                        </div>
                    </a>
                ))
            ) : (
                <div className="empty">题库整理中,先看看热门题目吧</div>
            )}
        </>
    )
}
