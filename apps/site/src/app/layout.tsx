import type { Metadata } from 'next'
import Script from 'next/script'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { SITE_NAME, SITE_URL } from '@/lib/site-api'
import './globals.css'

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: `${SITE_NAME} — 前端/算法面试题与解析`,
        template: `%s | ${SITE_NAME}`,
    },
    description: '免费的前端与算法面试题库:AI + 人工双审,每题带分层答案与记忆口诀。',
    openGraph: {
        siteName: SITE_NAME,
        type: 'website',
    },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    const baiduId = process.env.NEXT_PUBLIC_BA_ID
    return (
        <html lang="zh-CN">
            <body>
                <SiteHeader />
                <main className="container">{children}</main>
                <SiteFooter />
                {/* 百度统计:NEXT_PUBLIC_BA_ID 未配置时渲染 nothing */}
                {baiduId ? (
                    <Script
                        src={`https://hm.baidu.com/hm.js?${baiduId}`}
                        strategy="afterInteractive"
                    />
                ) : null}
            </body>
        </html>
    )
}
