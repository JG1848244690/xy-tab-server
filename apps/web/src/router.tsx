import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import DashboardLayout from '@/layouts/dashboard-layout'
import { RequireAuth } from '@/components/require-auth'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { useAuthStore } from '@/store/auth-store'

/**
 * 全部页面懒加载(F1):以前静态 import,monaco/md-editor/x6/fullcalendar/
 * recharts 全挤进首屏主包(2.4MB)。lazy 后每个页面独立 chunk,
 * 按路由分包,重依赖只随所在页面下载。
 */
const LoginPage = lazy(() => import('@/pages/login/page'))
const VerifyEmailPage = lazy(() => import('@/pages/verify-email/page'))
const HomePage = lazy(() => import('@/pages/home/page'))
const TodosPage = lazy(() => import('@/pages/todos/page'))
const TestCenterPage = lazy(() => import('@/pages/test-center/page'))
const PracticePage = lazy(() => import('@/pages/test-center/practice/[id]/page'))
const ReviewPage = lazy(() => import('@/pages/review/page'))
const MediaPage = lazy(() => import('@/pages/media/page'))
const ArticlesPage = lazy(() => import('@/pages/articles/page'))
const ArticleEditorPage = lazy(() => import('@/pages/articles/editor'))
const StatisticsPage = lazy(() => import('@/pages/statistics/page'))
const SettingsPage = lazy(() => import('@/pages/settings/page'))
const DrawerPage = lazy(() => import('@/pages/drawer/page'))

// 移动端是独立的一套 UI(单列 + 底部 tab),和桌面的侧栏工作台互不影响
const MobileLayout = lazy(() => import('@/pages/mobile/layout'))
const MobileQuestions = lazy(() => import('@/pages/mobile/questions'))
const MobilePractice = lazy(() => import('@/pages/mobile/practice'))
const MobileMe = lazy(() => import('@/pages/mobile/me'))

const MOBILE_QUERY = '(max-width: 767px)'

function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
}

function RootRedirect() {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  // 手机上直接进移动端首页,不再先渲染一次桌面壳
  return <Navigate to={isMobileViewport() ? '/m/questions' : '/home'} replace />
}

/** 桌面页面的补位:手机误入 /test-center 时转到移动端题库 */
function MobileAware({
  mobileTo,
  children,
}: {
  mobileTo: string
  children: React.ReactNode
}) {
  const mobile = useIsMobile()
  return mobile ? <Navigate to={mobileTo} replace /> : <>{children}</>
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
  // 邮件里的验证链接落地页:公开路由,不需要登录(可能在另一台设备上点开)
  { path: '/verify-email', element: page(<VerifyEmailPage />) },
  { path: '/register', element: <Navigate to="/login" replace /> },
  {
    path: '/m',
    element: (
      <RequireAuth>
        {page(<MobileLayout />)}
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/m/questions" replace /> },
      { path: 'questions', element: page(<MobileQuestions />) },
      { path: 'practice/:id', element: page(<MobilePractice />) },
      { path: 'me', element: page(<MobileMe />) },
    ],
  },
  {
    element: (
      <RequireAuth>
        <DashboardLayout />
      </RequireAuth>
    ),
    children: [
      { path: '/home', element: page(<MobileAware mobileTo="/m/questions"><HomePage /></MobileAware>) },
      { path: '/todos', element: page(<TodosPage />) },
      { path: '/test-center', element: page(<MobileAware mobileTo="/m/questions"><TestCenterPage /></MobileAware>) },
      { path: '/test-center/practice/:id', element: page(<MobileAware mobileTo="/m/questions"><PracticePage /></MobileAware>) },
      { path: '/review', element: page(<ReviewPage />) },
      { path: '/media', element: page(<MediaPage />) },
      { path: '/articles', element: page(<ArticlesPage />) },
      { path: '/articles/:id', element: page(<ArticleEditorPage />) },
      // 合集已并入文章页,旧的直达链接重定向过去
      { path: '/collections', element: <Navigate to="/articles" replace /> },
      { path: '/statistics', element: page(<StatisticsPage />) },
      { path: '/settings', element: page(<SettingsPage />) },
      { path: '/drawer', element: page(<DrawerPage />) },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
