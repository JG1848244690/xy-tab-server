import { BookOpen, User as UserIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'

/**
 * 移动端外壳:顶部极简栏 + 底部 tab。
 *
 * 和桌面端是两套 UI:桌面是「侧栏 + 多栏工作台」,手机是「单列 + 底部导航」。
 * 管理类重操作(编辑、审核、X6 绘图)仍然只在桌面端提供,这里只做「看题 + 刷题 + 账号」。
 */
export default function MobileLayout() {
  const tabs = [
    { to: '/m/questions', label: '题库', icon: BookOpen },
    { to: '/m/me', label: '我的', icon: UserIcon },
  ]

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <img src="/icon-96.png" alt="序言" className="h-6 w-6 rounded-[4px] object-cover" />
          <span className="font-serif text-[15px] leading-none tracking-tight">序言</span>
        </div>
      </header>

      <main className="min-h-0 flex-1 pb-[calc(56px+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className="grid h-14 grid-cols-2">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-0.5 text-[11px] transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              <t.icon className="h-[18px] w-[18px]" />
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
