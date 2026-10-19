'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

/**
 * 主题切换:暗色模式。
 * - 存 localStorage('theme'),SSG 页面 hydration 后接管
 * - layout.tsx 里的内联脚本在首帧前就设好 html.dark,不会闪白
 */
export function ThemeToggle() {
    const [theme, setTheme] = useState<'light' | 'dark' | null>(null)

    useEffect(() => {
        setTheme(
            document.documentElement.classList.contains('dark') ? 'dark' : 'light',
        )
    }, [])

    function toggle() {
        const next = theme === 'dark' ? 'light' : 'dark'
        setTheme(next)
        document.documentElement.classList.toggle('dark', next === 'dark')
        localStorage.setItem('theme', next)
    }

    return (
        <button
            className="grid size-9 flex-none place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
            onClick={toggle}
            aria-label={theme === 'dark' ? '切换到亮色' : '切换到暗色'}
            title={theme === 'dark' ? '切换到亮色' : '切换到暗色'}
        >
            {/* 未 hydrate 前不渲染图标,防两侧不一致 */}
            {theme === 'dark' ? <Sun className="size-4" /> : theme === 'light' ? <Moon className="size-4" /> : null}
        </button>
    )
}
