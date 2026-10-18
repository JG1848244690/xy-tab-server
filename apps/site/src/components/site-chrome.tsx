import Link from 'next/link'
import { SITE_NAME } from '@/lib/site-api'

const NAV = [
    { href: '/banks', label: '题库' },
    { href: '/articles', label: '文章' },
    { href: '/digest', label: '荟萃' },
]

/** 后台 SPA 地址:我要出题跳过去(题目录入在登录后的 SPA 里) */
const WEB_APP_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://hls.kskbl.com.cn/test-center'

export function SiteHeader() {
    return (
        <header className="site-header">
            <div className="container">
                <Link href="/" className="brand">
                    HLS <span>面试题库</span>
                </Link>
                <nav className="site-nav">
                    {NAV.map((n) => (
                        <Link key={n.href} href={n.href}>
                            {n.label}
                        </Link>
                    ))}
                    <a href={WEB_APP_URL} data-track="click_contribute" rel="nofollow">
                        我要出题
                    </a>
                </nav>
            </div>
        </header>
    )
}

export function SiteFooter() {
    const icp = process.env.NEXT_PUBLIC_ICP
    return (
        <footer className="site-footer">
            <div className="container">
                © {new Date().getFullYear()} {SITE_NAME}
                {icp ? (
                    <>
                        {' · '}
                        <a href="https://beian.miit.gov.cn/" rel="nofollow noopener">
                            {icp}
                        </a>
                    </>
                ) : null}
            </div>
        </footer>
    )
}
