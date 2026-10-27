import { Link, Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { DashboardNav } from '@/components/dashboard-nav'
import { UserNav } from '@/components/user-nav'
import { ThemeToggle } from '@/components/theme-toggle'
import { ThemeColorToggle } from '@/components/theme-color-toggle'
import { TodosDropdown } from '@/components/todos-dropdown'
import { RouteLoadingIndicator } from '@/components/route-loading-indicator'
import { useState, useEffect } from 'react'
import BreadCrumb from '@/components/breadcrumb'
export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isOpening, setIsOpening] = useState(false)
  const [mounted, setMounted] = useState(false)

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
      {/* 桌面侧栏 */}
      <div
        className={`hidden border-r bg-gray-100/40 lg:block dark:bg-gray-800/40 lg:sticky lg:top-0 lg:h-screen transition-all duration-300 shrink-0 ${
          collapsed ? 'lg:w-16' : 'lg:w-50'
        }`}
      >
        <div className="flex h-full flex-col gap-2">
          {/* 侧栏header logo和折叠按钮 */}
          <div className="flex h-15 items-center border-b px-6 justify-between">
            {!collapsed && (
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
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 hover:bg-primary/10 rounded transition-colors"
              aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
          {/* menu */}
          <div className="flex-1 overflow-y-auto py-2">
            <DashboardNav collapsed={collapsed} />
          </div>
        </div>
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
            className={`fixed top-0 left-0 right-0 h-auto bg-white dark:bg-gray-800 z-50 lg:hidden shadow-lg transition-transform duration-300 ${
              isOpening ? 'translate-y-0' : '-translate-y-full'
            }`}
          >
            <div className="flex h-15 items-center border-b px-6 justify-between">
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
              <DashboardNav collapsed={false} />
            </div>
          </div>
        </>
      )}

      <div className="flex flex-col min-h-screen lg:h-screen flex-1 min-w-0">
        <header className="sticky top-0 z-10 flex h-14 lg:h-15 items-center gap-4 border-b bg-primary/5 backdrop-blur-sm px-6">
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
        <main className="flex flex-1 flex-col p-4  overflow-y-auto overflow-x-hidden min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
