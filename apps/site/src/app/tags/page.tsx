import type { Metadata } from 'next'
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
            <p className="page-sub">按主题横向串联题目;介绍不足 240 字的标签页不会被收录。</p>
            <div className="tag-cloud">
                {tags.data.map((t) => (
                    <a key={t.slug} href={`/tag/${t.slug}`}>
                        {t.name}
                        <small>{t.questionCount}</small>
                    </a>
                ))}
                {tags.data.length === 0 ? <div className="empty">还没有登记标签</div> : null}
            </div>
        </>
    )
}
