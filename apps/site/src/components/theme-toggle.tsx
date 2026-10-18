'use client'

import { useEffect, useState } from 'react'

/**
 * 主题切换:暗色模式(S2)。
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
            className="theme-btn"
            onClick={toggle}
            aria-label={theme === 'dark' ? '切换到亮色' : '切换到暗色'}
            title={theme === 'dark' ? '切换到亮色' : '切换到暗色'}
        >
            {theme === 'dark' ? '☀' : '☾'}
        </button>
    )
}
