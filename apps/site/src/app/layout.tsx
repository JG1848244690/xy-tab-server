import type { Metadata } from 'next'
// 2026-10-28: 语雀题库批量导入(322 题)后触发静态重建
// 2026-10-28: 题库归类完成后再次重建
import Script from 'next/script'
import { SiteFooter } from '@/components/site-chrome'
import { SiteChrome } from '@/components/site-header'
import { SITE_NAME, SITE_URL } from '@/lib/site-api'
import './globals.css'

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: '序言-免费的web开发面试题站点',
        template: '%s | 序言',
    },
    description: '序言 · 免费的 Web 开发面试题库:AI + 人工双审,每题带分层答案与记忆口诀。',
    openGraph: {
        siteName: SITE_NAME,
        type: 'website',
    },
}

/** 防主题闪烁:首帧前定明暗,localStorage 优先,其次系统偏好 */
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
    const baiduId = process.env.NEXT_PUBLIC_BA_ID
    return (
        <html lang="zh-CN" suppressHydrationWarning>
            <body>
                <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
                <SiteChrome
                    brand={
                        <>
                            <img
                                src="/icon.png"
                                alt="序言"
                                className="size-6 rounded-lg object-cover shadow-sm"
                            />
                            序言
                        </>
                    }
                />
                <main className="py-9 sm:py-10">
                    <div className="mx-auto max-w-[1120px] px-5 sm:px-6">{children}</div>
                </main>
                <SiteFooter />
                {/* 百度统计:NEXT_PUBLIC_BA_ID 未配置时不注入 */}
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
