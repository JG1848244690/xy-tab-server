import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import DashboardLayout from '@/layouts/dashboard-layout'
import { RequireAuth } from '@/components/require-auth'
import { useAuthStore } from '@/store/auth-store'

/**
 * 全部页面懒加载(F1):以前静态 import,monaco/md-editor/x6/fullcalendar/
 * recharts 全挤进首屏主包(2.4MB)。lazy 后每个页面独立 chunk,
 * 按路由分包,重依赖只随所在页面下载。
 */
const LoginPage = lazy(() => import('@/pages/login/page'))
const HomePage = lazy(() => import('@/pages/home/page'))
const TodosPage = lazy(() => import('@/pages/todos/page'))
const TestCenterPage = lazy(() => import('@/pages/test-center/page'))
const PracticePage = lazy(() => import('@/pages/test-center/practice/[id]/page'))
const StatisticsPage = lazy(() => import('@/pages/statistics/page'))
const SettingsPage = lazy(() => import('@/pages/settings/page'))
const DrawerPage = lazy(() => import('@/pages/drawer/page'))

function RootRedirect() {
  const user = useAuthStore((s) => s.user)
  return <Navigate to={user ? '/home' : '/login'} replace />
}

function PageLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
    </div>
  )
}

function page(node: React.ReactNode) {
  return <Suspense fallback={<PageLoading />}>{node}</Suspense>
}

export const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  { path: '/login', element: page(<LoginPage />) },
  { path: '/register', element: <Navigate to="/login" replace /> },
  {
    element: (
      <RequireAuth>
        <DashboardLayout />
      </RequireAuth>
    ),
    children: [
      { path: '/home', element: page(<HomePage />) },
      { path: '/todos', element: page(<TodosPage />) },
      { path: '/test-center', element: page(<TestCenterPage />) },
      { path: '/test-center/practice/:id', element: page(<PracticePage />) },
      { path: '/statistics', element: page(<StatisticsPage />) },
      { path: '/settings', element: page(<SettingsPage />) },
      { path: '/drawer', element: page(<DrawerPage />) },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
