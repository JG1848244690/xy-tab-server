import { siteApi, absoluteUrl } from '@/lib/site-api'

// 静态导出要求:构建期生成一次
export const dynamic = 'force-static'

/**
 * sitemap 索引(构建期静态生成)。
 *
 * 目前站点只有一个 sitemap(`/sitemap.xml`),这个索引存在的意义是:
 * GSC 里对已经「卡住」的 sitemap 地址无法强制重抓,换一个新的提交入口
 * (索引地址)往往能重新排进队列。等站点超过 5 万 URL 需要分片时,
 * 这里会自然变成真正的多片索引。
 */
export async function GET() {
    const data = await siteApi.sitemapData()

    const dates = [
        ...data.questions.map((q) => q.updatedAt),
        ...data.articles.map((a) => a.updatedAt),
        ...data.banks.map((b) => b.updatedAt),
    ].filter((d): d is string => Boolean(d))

    const latest = dates.sort().at(-1) ?? new Date().toISOString()

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${absoluteUrl('/sitemap.xml')}</loc>
    <lastmod>${latest}</lastmod>
  </sitemap>
</sitemapindex>
`

    return new Response(xml, {
        headers: {
            'content-type': 'application/xml; charset=utf-8',
            'cache-control': 'no-cache',
        },
    })
}
