import { Link, Outlet } from 'react-router-dom'
import { Menu, X, Pin, PinOff } from 'lucide-react'
import { DashboardNav } from '@/components/dashboard-nav'
import { UserNav } from '@/components/user-nav'
import { ThemeToggle } from '@/components/theme-toggle'
import { ThemeColorToggle } from '@/components/theme-color-toggle'
import { TodosDropdown } from '@/components/todos-dropdown'
import { RouteLoadingIndicator } from '@/components/route-loading-indicator'
import { EmailVerificationBanner } from '@/components/email-verification-banner'
import { useState, useEffect } from 'react'
import BreadCrumb from '@/components/breadcrumb'
export default function DashboardLayout() {
  const [pinned, setPinned] = useState(() => localStorage.getItem('nav-pinned') === '1')
  const [hover, setHover] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isOpening, setIsOpening] = useState(false)
  const [mounted, setMounted] = useState(false)

  const expanded = pinned || hover

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleOpen = () => {
    setMobileMenuOpen(true)
    setTimeout(() => setIsOpening(true), 10)
  }

  const handleClose = () => {
    setIsOpening(false)
    setTimeout(() => {
      setMobileMenuOpen(false)
    }, 300)
  }

  return (
    <div className="flex min-h-screen w-full">
      <RouteLoadingIndicator />
      {/* 桌面侧栏:图标轨道,鼠标悬停「浮」出完整菜单,不挤压主内容 */}
      <div
        className="relative hidden h-screen shrink-0 transition-[width] duration-200 ease-out lg:block"
        style={{ width: pinned ? 216 : 64 }}
      >
        <aside
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className={`absolute inset-y-0 left-0 z-30 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-[width,box-shadow] duration-200 ease-out ${
            expanded ? 'w-[216px]' : 'w-16'
          } ${hover && !pinned ? 'shadow-[8px_0_28px_rgb(20_19_16/0.10)]' : ''}`}
        >
          {/* 顶部:logo + 固定/收起 */}
          <div className="flex h-15 items-center justify-between border-b border-sidebar-border px-3">
            <Link
              to="/home"
              title="序言"
              className="flex items-center gap-2.5 text-foreground transition-colors hover:text-primary"
            >
              <img
                src="/icon-96.png"
                alt="序言"
                className="h-7 w-7 flex-none rounded-[4px] object-cover"
              />
              <span
                className={`overflow-hidden whitespace-nowrap font-serif text-[15px] transition-opacity duration-150 ${
                  expanded ? 'opacity-100' : 'opacity-0'
                }`}
              >
                序言
              </span>
            </Link>
            <button
              onClick={() => {
                const next = !pinned
                setPinned(next)
                localStorage.setItem('nav-pinned', next ? '1' : '0')
              }}
              className={`flex-none rounded p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground ${
                expanded ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
              aria-label={pinned ? '取消固定' : '固定展开'}
              title={pinned ? '取消固定' : '固定展开'}
            >
              {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </button>
          </div>

          {/* 菜单 */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">
            <DashboardNav expanded={expanded} />
          </div>
        </aside>
      </div>

      {/* 移动端侧栏 */}
      {mobileMenuOpen && (
        <>
          <div
            className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300 ${
              isOpening ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={handleClose}
          />
          <div
            className={`fixed top-0 left-0 right-0 h-auto bg-card border-b border-border z-50 lg:hidden shadow-lg transition-transform duration-300 ${
              isOpening ? 'translate-y-0' : '-translate-y-full'
            }`}
          >
            <div className="flex h-15 items-center border-b border-sidebar-border px-6 justify-between">
              <Link
                className="flex items-center gap-2 font-semibold text-primary hover:text-primary/80 transition-colors"
                to="/home"
              >
                <img
                  src="/icon-96.png"
                  alt="序言"
                  className="h-7 w-7 rounded-md object-cover"
                />
                <span>序言</span>
              </Link>
              <button
                onClick={handleClose}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto py-2">
              <DashboardNav expanded />
            </div>
          </div>
        </>
      )}

      <div className="flex flex-col min-h-screen lg:h-screen flex-1 min-w-0">
        <header className="sticky top-0 z-10 flex h-14 lg:h-15 items-center gap-4 border-b border-border bg-background/85 backdrop-blur-md px-6">
          <button
            onClick={handleOpen}
            className="lg:hidden p-1.5 hover:bg-primary/10 rounded transition-colors"
            aria-label="打开菜单"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="w-full flex-1">
            <BreadCrumb></BreadCrumb>
          </div>
          {mounted && (
            <>
              <TodosDropdown />
              <ThemeColorToggle />
              <ThemeToggle />
              <UserNav />
            </>
          )}
        </header>
        <main className="flex flex-1 flex-col p-4 min-h-0 overflow-y-auto overflow-x-hidden min-w-0">
          <EmailVerificationBanner />
          <Outlet />
        </main>
      </div>
    </div>
  )
}
