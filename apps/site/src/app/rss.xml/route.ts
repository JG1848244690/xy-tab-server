import { siteApi, SITE_URL, SITE_NAME } from '@/lib/site-api'

/**
 * RSS 订阅(静态导出:构建期生成一次)。
 * 内容以文章为主;题目增量也可以进 feed,先只放文章保持克制。
 */
export const dynamic = 'force-static'

function escapeXml(s: string) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export async function GET() {
    const articles = await siteApi.articles({ size: 50 })
    const items = articles.data
        .map(
            (a) => `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${SITE_URL}/article/${a.slug}</link>
      <guid isPermaLink="true">${SITE_URL}/article/${a.slug}</guid>
      <pubDate>${a.publishedAt ? new Date(a.publishedAt).toUTCString() : new Date().toUTCString()}</pubDate>
      <description>${escapeXml(a.excerpt ?? a.comment ?? '')}</description>
    </item>`,
        )
        .join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${SITE_NAME}</title>
    <link>${SITE_URL}</link>
    <description>每周精选面试题与文章导读</description>
${items}
  </channel>
</rss>`

    return new Response(xml, {
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    })
}
