'use client'

import { useState } from 'react'
import { ArrowRight, Menu, X } from 'lucide-react'
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

    return (
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
            <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-5 px-5 sm:px-6">
                <a href="/" className="flex items-center gap-2.5 text-[15.5px] font-bold tracking-tight" onClick={() => setOpen(false)}>
                    {brand}
                </a>

                <button
                    className="ml-auto grid size-9 place-items-center rounded-lg border border-border bg-card text-foreground/80 sm:hidden"
                    aria-expanded={open}
                    aria-label={open ? '收起菜单' : '打开菜单'}
                    onClick={() => setOpen((v) => !v)}
                >
                    {open ? <X className="size-4" /> : <Menu className="size-4" />}
                </button>

                <nav
                    className={[
                        'gap-1 text-sm sm:ml-auto sm:flex',
                        open
                            ? 'absolute top-14 left-0 right-0 flex-col items-stretch border-b border-border bg-card p-3 shadow-xl sm:static sm:flex-row sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none'
                            : 'hidden',
                    ].join(' ')}
                >
                    {NAV.map((n) => (
                        <a
                            key={n.href}
                            href={n.href}
                            className="flex min-h-11 items-center rounded-lg px-3 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:min-h-0"
                            onClick={() => setOpen(false)}
                        >
                            {n.label}
                        </a>
                    ))}
                    <a
                        href={WEB_APP_URL}
                        className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 font-semibold text-accent transition-colors hover:bg-muted sm:min-h-0"
                        rel="nofollow"
                        onClick={() => setOpen(false)}
                    >
                        我要出题
                        <ArrowRight className="size-3.5" />
                    </a>
                </nav>

                <ThemeToggle />
            </div>
        </header>
    )
}
