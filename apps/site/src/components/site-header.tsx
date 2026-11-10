'use client'

import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
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
 * 页头:桌面 = 品牌 | 右侧导航+主题切换(ml-auto 撑开,正确分布);
 * 移动端 = 品牌 | 汉堡抽屉 | 主题切换。
 */
export function SiteChrome({ brand }: { brand: React.ReactNode }) {
    const [open, setOpen] = useState(false)
    /** 滚动后加一条极浅的投影,页头和内容之间有层次 */
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8)
        onScroll()
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    return (
        <header
            className={[
                'sticky top-0 z-20 border-b backdrop-blur-md transition-[background-color,box-shadow] duration-300',
                scrolled
                    ? 'border-border bg-background/95 shadow-[0_1px_10px_rgb(20_19_16/0.06)]'
                    : 'border-border bg-background/88',
            ].join(' ')}
        >
            <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-6 px-5 sm:px-6">
                <a href="/" className="flex items-center gap-2.5 text-[17px] tracking-tight" onClick={() => setOpen(false)}>
                    {brand}
                </a>

                <button
                    className="ml-auto grid size-9 place-items-center rounded-[3px] border border-border bg-card text-foreground/80 sm:hidden"
                    aria-expanded={open}
                    aria-label={open ? '收起菜单' : '打开菜单'}
                    onClick={() => setOpen((v) => !v)}
                >
                    {open ? <X className="size-4" /> : <Menu className="size-4" />}
                </button>

                <nav
                    className={[
                        'gap-1 text-[13.5px] sm:ml-auto sm:flex',
                        open
                            ? 'absolute top-16 left-0 right-0 flex-col items-stretch border-b border-border bg-card p-3 sm:static sm:flex-row sm:border-0 sm:bg-transparent sm:p-0'
                            : 'hidden',
                    ].join(' ')}
                >
                    {NAV.map((n) => (
                        <a
                            key={n.href}
                            href={n.href}
                            className="nav-link flex min-h-11 items-center px-3 text-muted-foreground transition-colors hover:text-foreground sm:min-h-0"
                            onClick={() => setOpen(false)}
                        >
                            {n.label}
                        </a>
                    ))}
                    <a
                        href={WEB_APP_URL}
                        className="nav-link ml-1 flex min-h-11 items-center px-3 text-foreground transition-colors hover:text-seal sm:min-h-0"
                        rel="nofollow"
                        onClick={() => setOpen(false)}
                    >
                        贡献题目
                    </a>
                </nav>

                <ThemeToggle />
            </div>
        </header>
    )
}
