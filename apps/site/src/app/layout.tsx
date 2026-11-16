import type { Metadata } from 'next'
// 2026-10-28: 语雀题库批量导入(322 题)后触发静态重建
// 2026-10-28: 题库归类完成后再次重建
// 2026-10-29: 走查后内容修复(假题干/空标签/残缺标题)触发重建
import Script from 'next/script'
import { SiteFooter } from '@/components/site-chrome'
import { SiteChrome } from '@/components/site-header'
import { SentryInit } from '@/components/sentry-init'
import { GoogleAnalytics } from '@/components/google-analytics'
import { SITE_NAME, SITE_URL } from '@/lib/site-api'
import './globals.css'

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: '序言 · Web 开发知识点汇总',
        template: '%s | 序言',
    },
    description: '序言 · 免费开放的 Web 开发知识库:AI + 人工双审,每个知识点带分层解析与记忆口诀。',
    openGraph: {
        siteName: SITE_NAME,
        type: 'website',
    },
    verification: {
        // 百度站长平台 HTML 标签验证(必须是首页 head 里的 meta)
        other: {
            'baidu-site-verification': ['codeva-ckyZyKwlNS'],
        },
    },
}

/** 防主题闪烁:首帧前定明暗,localStorage 优先,其次系统偏好 */
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
    const baiduId = process.env.NEXT_PUBLIC_BA_ID
    return (
        <html lang="zh-CN" suppressHydrationWarning>
            <body>
                <SentryInit />
                <GoogleAnalytics />
                <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
                <SiteChrome
                    brand={
                        <>
                            <img
                                src="/icon.png"
                                alt=""
                                width={28}
                                height={28}
                                className="size-7 rounded-[4px] object-cover"
                            />
                            <span className="font-serif font-semibold">序言</span>
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
                {/* 百度自动推送:被访问的页面自动进收录队列,登录后无 token 也可用 */}
                <Script id="baidu-auto-push" strategy="lazyOnload">
                    {`(function(){try{var bp=document.createElement('script');bp.src='//push.zhanzhang.baidu.com/push.js';var s=document.getElementsByTagName('script')[0];s.parentNode.insertBefore(bp,s);}catch(e){}})()`}
                </Script>
            </body>
        </html>
    )
}
