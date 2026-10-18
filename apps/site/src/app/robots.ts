import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site-api'

// 静态导出要求
export const dynamic = 'force-static'

/**
 * robots:搜索引擎 + 主流 AI 爬虫全放行(plan §4.3 —— AEO 引用来源,
 * 别自我阉割;Bytespider 视带宽压力 P4 再定)。
 */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            { userAgent: '*', allow: '/' },
            // 显式欢迎主流 AI 爬虫(默认 * 已放行,这里写明是姿态)
            { userAgent: 'GPTBot', allow: '/' },
            { userAgent: 'ClaudeBot', allow: '/' },
            { userAgent: 'Google-Extended', allow: '/' },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    }
}
