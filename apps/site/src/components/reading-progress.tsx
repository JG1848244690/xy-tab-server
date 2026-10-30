'use client'

import { useEffect, useRef } from 'react'

/**
 * 题目页阅读进度条:顶部 2px,不用 state 触发 React 重渲染,
 * 直接改 transform,滚动时零重排。
 */
export function ReadingProgress() {
    const barRef = useRef<HTMLSpanElement>(null)

    useEffect(() => {
        const bar = barRef.current
        if (!bar) return

        let raf = 0
        const update = () => {
            raf = 0
            const doc = document.documentElement
            const max = doc.scrollHeight - window.innerHeight
            const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
            bar.style.transform = `scaleX(${progress})`
        }
        const onScroll = () => {
            if (raf) return
            raf = window.requestAnimationFrame(update)
        }

        update()
        window.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('resize', onScroll, { passive: true })
        return () => {
            window.removeEventListener('scroll', onScroll)
            window.removeEventListener('resize', onScroll)
            if (raf) window.cancelAnimationFrame(raf)
        }
    }, [])

    return (
        <div className="reading-progress" aria-hidden>
            <span ref={barRef} />
        </div>
    )
}
