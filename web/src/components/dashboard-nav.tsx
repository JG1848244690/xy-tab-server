import { Link, useLocation } from 'react-router-dom'
import { Home, Settings, AlarmClockCheck, ListChecks, ChartSpline, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DashboardNavProps {
  collapsed?: boolean
}
export const navItems = [
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

  return (
    <nav className="grid items-start px-4 text-sm font-medium">
      {navItems.map((item, index) => {
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
