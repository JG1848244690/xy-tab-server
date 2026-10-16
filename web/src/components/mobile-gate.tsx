import { Monitor } from 'lucide-react'

import { useIsMobile } from '@/hooks/use-is-mobile'

/**
 * 移动端拦截器:触摸端做不了/做不好的页面(练习编辑器、画板),
 * 直接不渲染内容,引导去桌面端 —— 与其给一个错乱能点但没法用的页面,
 * 不如明说。好改的响应式页面不走这个,照常渲染。
 *
 * 用法:<MobileGate><练习页内容/></MobileGate>
 */
export function MobileGate({ children }: { children: React.ReactNode }) {
    const isMobile = useIsMobile()

    if (!isMobile) return <>{children}</>

    return (
        <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Monitor className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
                <p className="text-lg font-semibold">请使用网页端访问本页面</p>
                <p className="text-sm text-muted-foreground">
                    当前页面在手机上无法获得完整体验,请在电脑浏览器中打开
                </p>
            </div>
        </div>
    )
}
