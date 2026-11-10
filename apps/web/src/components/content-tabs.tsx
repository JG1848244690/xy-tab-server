import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

/**
 * 内容模块内的二级切换:文章 / 合集。
 * 侧边栏只保留一个「文章」入口,避免两个同级菜单看起来像两套独立功能。
 */
const TABS = [
    { href: '/articles', label: '文章' },
    { href: '/collections', label: '合集' },
]

export function ContentTabs() {
    const { pathname } = useLocation()

    return (
        <div className="flex items-center gap-1 border-b">
            {TABS.map((tab) => {
                const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
                return (
                    <Link
                        key={tab.href}
                        to={tab.href}
                        className={cn(
                            '-mb-px border-b-2 px-3 py-2 text-sm transition-colors',
                            active
                                ? 'border-primary font-medium text-foreground'
                                : 'border-transparent text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {tab.label}
                    </Link>
                )
            })}
        </div>
    )
}
