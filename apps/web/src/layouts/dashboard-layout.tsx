import { Link, Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { DashboardNav, TopNav } from '@/components/dashboard-nav'
import { UserNav } from '@/components/user-nav'
import { ThemeToggle } from '@/components/theme-toggle'
import { ThemeColorToggle } from '@/components/theme-color-toggle'
import { TodosDropdown } from '@/components/todos-dropdown'
import { RouteLoadingIndicator } from '@/components/route-loading-indicator'
import { useState, useEffect } from 'react'
import BreadCrumb from '@/components/breadcrumb'

export default function DashboardLayout() {
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
    <div className="flex min-h-screen flex-col lg:h-screen">
      <RouteLoadingIndicator />

      {/* 顶部导航:品牌 + 模块 + 全局操作 */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="flex h-16 items-center gap-2 px-4 sm:px-6">
          {/* 移动端菜单 */}
          <button
            onClick={handleOpen}
            className="-ml-1 rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
            aria-label="打开菜单"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* 品牌 */}
          <Link
            to="/home"
            className="flex flex-none items-center gap-2.5 text-foreground transition-colors hover:text-primary"
          >
            <img
              src="/icon-96.png"
              alt="序言"
              className="h-7 w-7 rounded-[4px] object-cover"
            />
            <span className="font-serif text-[15px] font-medium tracking-tight">序言</span>
            <span className="mt-0.5 hidden font-mono text-[9.5px] tracking-[0.18em] text-muted-foreground sm:inline">
              ADMIN
            </span>
          </Link>

          <span className="mx-2 hidden h-5 w-px bg-border lg:block" />

          {/* 桌面端模块导航 */}
          <TopNav />

          {/* 右侧全局操作 */}
          <div className="ml-auto flex flex-none items-center gap-0.5 pl-2">
            {mounted && (
              <>
                <TodosDropdown />
                <ThemeColorToggle />
                <ThemeToggle />
                <UserNav />
              </>
            )}
          </div>
        </div>

        {/* 面包屑 / 当前位置:细线一行,不跟内容抢注意力 */}
        <div className="hidden h-9 items-center border-t border-border/70 bg-card/40 px-4 sm:px-6 lg:flex">
          <BreadCrumb />
        </div>
      </header>

      {/* 移动端抽屉 */}
      {mobileMenuOpen && (
        <>
          <div
            className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 lg:hidden ${
              isOpening ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={handleClose}
          />
          <div
            className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-card shadow-xl transition-transform duration-300 lg:hidden ${
              isOpening ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <Link to="/home" className="flex items-center gap-2.5" onClick={handleClose}>
                <img
                  src="/icon-96.png"
                  alt="序言"
                  className="h-7 w-7 rounded-[4px] object-cover"
                />
                <span className="font-serif text-[15px] font-medium">序言</span>
              </Link>
              <button
                onClick={handleClose}
                className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="关闭菜单"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[calc(100vh-4rem)] overflow-y-auto py-3">
              <DashboardNav expanded />
            </div>
          </div>
        </>
      )}

      {/* 内容 */}
      <main className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto p-4 lg:p-6">
        <Outlet />
      </main>
    </div>
  )
}
