import type { Metadata } from 'next'
import Link from 'next/link'
import { siteApi } from '@/lib/site-api'

export const metadata: Metadata = {
    title: '全部标签',
    description: '按标签浏览面试题,覆盖前端、算法与工程实践主题。',
    alternates: { canonical: '/tags' },
}

export default async function TagsPage() {
    const tags = await siteApi.tags()

    return (
        <>
            <h1 className="page-title">标签</h1>
            <div className="tag-cloud">
                {tags.data.map((t) => (
                    <Link key={t.slug} href={`/tag/${t.slug}`} className="card" style={{ display: 'block' }}>
                        <h3>
                            {t.name} <small style={{ color: 'var(--muted)' }}>{t.questionCount}</small>
                        </h3>
                        {t.description ? <p>{t.description.slice(0, 60)}…</p> : null}
                    </Link>
                ))}
                {tags.data.length === 0 ? <div className="empty">还没有登记标签</div> : null}
            </div>
        </>
    )
}
