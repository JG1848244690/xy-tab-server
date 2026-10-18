'use client'

import { useState } from 'react'
import { ThemeToggle } from './theme-toggle'

const NAV = [
    { href: '/banks', label: '题库' },
    { href: '/tags', label: '标签' },
    { href: '/articles', label: '文章' },
    { href: '/digest', label: '荟萃' },
]

/** 后台 SPA:我要出题跳过去 */
const WEB_APP_URL =
    process.env.NEXT_PUBLIC_WEB_URL ?? 'https://hls.kskbl.com.cn/test-center'

/**
 * 页头:桌面单行导航,移动端汉堡抽屉(S3);右侧主题切换(S2)。
 * 点击外部收起抽屉;菜单按钮 aria-expanded 标注状态。
 */
export function SiteChrome({ brand }: { brand: React.ReactNode }) {
    const [open, setOpen] = useState(false)

    return (
        <header className="site-header">
            <div className="container">
                <a href="/" className="brand" onClick={() => setOpen(false)}>
                    {brand}
                </a>

                <button
                    className="menu-btn"
                    aria-expanded={open}
                    aria-label={open ? '收起菜单' : '打开菜单'}
                    onClick={() => setOpen((v) => !v)}
                >
                    {open ? '✕' : '☰'}
                </button>

                <nav className={`site-nav ${open ? 'open' : ''}`}>
                    {NAV.map((n) => (
                        <a key={n.href} href={n.href} onClick={() => setOpen(false)}>
                            {n.label}
                        </a>
                    ))}
                    <a
                        href={WEB_APP_URL}
                        className="nav-cta"
                        rel="nofollow"
                        onClick={() => setOpen(false)}
                    >
                        我要出题 →
                    </a>
                </nav>

                <ThemeToggle />
            </div>
        </header>
    )
}
