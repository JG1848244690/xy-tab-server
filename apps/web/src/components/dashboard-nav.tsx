import { Link, useLocation } from 'react-router-dom'
import { Home, Settings, AlarmClockCheck, ListChecks, ChartSpline, Palette, ShieldCheck, Images } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'

interface NavItem {
  title: string
  href: string
  icon: typeof Home
  /** 仅 admin 可见(显隐在前,权限边界在后端 requireAdmin/adminOnly) */
  adminOnly?: boolean
  children?: Record<string, { breadcrumb: (id: string) => string }>
}

interface DashboardNavProps {
  collapsed?: boolean
}
export const navItems: NavItem[] = [
  {
    title: '首页',
    href: '/home',
    icon: Home,
  },
  {
    title: '打卡',
    href: '/todos',
    icon: AlarmClockCheck,
  },
  {
    title: '题库',
    href: '/test-center',
    icon: ListChecks,
    children: {
      'practice/[id]': {
        breadcrumb: (id: string) => `题目详情`,
      },
    },
  },
  {
    title: '画板',
    href: '/drawer',
    icon: Palette,
  },
  {
    // 审核:只有 admin 能看到(AI 前置审核 + 人工裁决 + 打回记录)。
    // 名字统一用「审核」——新题先进这里,过审才进题库(2026-10-26)
    title: '审核',
    href: '/review',
    icon: ShieldCheck,
    adminOnly: true,
  },
  {
    // 图库:图片统一管理(上传/引用检查/清理),仅 admin
    title: '图库',
    href: '/media',
    icon: Images,
    adminOnly: true,
  },
  {
    title: '统计',
    href: '/statistics',
    icon: ChartSpline,
  },
  {
    title: '设置',
    href: '/settings',
    icon: Settings,
  },
]

export function DashboardNav({ collapsed = false }: DashboardNavProps) {
  const { pathname } = useLocation()
  const role = useAuthStore((s) => s.user?.role)
  const visibleItems = navItems.filter((item) => !item.adminOnly || role === 'admin')

  return (
    <nav className="grid items-start px-4 text-sm font-medium">
      {visibleItems.map((item, index) => {
        const Icon = item.icon
        const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)

        return (
          <Link
            key={index}
            to={item.href}
            title={collapsed ? item.title : undefined}
            className={cn(
              'flex items-center rounded-lg px-3 py-2 transition-all',
              collapsed ? 'justify-center' : 'gap-3',
              isActive
                ? 'bg-primary/10 text-primary font-semibold shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:bg-primary/5 hover:text-primary'
            )}
          >
            <Icon className={cn('h-4 w-4', isActive && 'text-primary')} />
            {!collapsed && <span>{item.title}</span>}
          </Link>
        )
      })}
    </nav>
  )
}
