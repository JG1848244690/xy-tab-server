import { Link, useLocation } from 'react-router-dom'
import { Home, Settings, AlarmClockCheck, ListChecks, ChartSpline, Palette, ShieldCheck, Images, FileText } from 'lucide-react'
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
  /** 展开时显示文字;收起时只留图标 + 悬停提示 */
  expanded?: boolean
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
    // 文章:原创 markdown + 外部荐文;合集是它下面的第二个 tab,不单独占菜单
    title: '文章',
    href: '/articles',
    icon: FileText,
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

export function DashboardNav({ expanded = false }: DashboardNavProps) {
  const { pathname } = useLocation()
  const role = useAuthStore((s) => s.user?.role)
  const visibleItems = navItems.filter((item) => !item.adminOnly || role === 'admin')

  return (
    <nav className="grid items-start gap-0.5 px-2 text-sm">
      {visibleItems.map((item, index) => {
        const Icon = item.icon
        const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)

        return (
          <Link
            key={index}
            to={item.href}
            title={expanded ? undefined : item.title}
            className={cn(
              'group relative flex items-center rounded-md py-2 transition-colors',
              expanded ? 'gap-3 px-2.5' : 'justify-center px-0',
              isActive
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-foreground',
            )}
          >
            {/* 选中标记:左侧朱砂竖线 */}
            <span
              className={cn(
                'absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-primary transition-opacity',
                isActive ? 'opacity-100' : 'opacity-0',
              )}
            />
            <Icon className={cn('h-4 w-4 flex-none', isActive && 'text-primary')} />
            {expanded ? <span className="truncate">{item.title}</span> : null}
          </Link>
        )
      })}
    </nav>
  )
}
