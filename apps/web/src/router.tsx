import { createBrowserRouter, Navigate } from 'react-router-dom'
import DashboardLayout from '@/layouts/dashboard-layout'
import LoginPage from '@/pages/login/page'
import HomePage from '@/pages/home/page'
import TodosPage from '@/pages/todos/page'
import TestCenterPage from '@/pages/test-center/page'
import PracticePage from '@/pages/test-center/practice/[id]/page'
import StatisticsPage from '@/pages/statistics/page'
import SettingsPage from '@/pages/settings/page'
import DrawerPage from '@/pages/drawer/page'
import { RequireAuth } from '@/components/require-auth'
import { useAuthStore } from '@/store/auth-store'

function RootRedirect() {
  const user = useAuthStore((s) => s.user)
  return <Navigate to={user ? '/home' : '/login'} replace />
}

export const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <Navigate to="/login" replace /> },
  {
    element: (
      <RequireAuth>
        <DashboardLayout />
      </RequireAuth>
    ),
    children: [
      { path: '/home', element: <HomePage /> },
      { path: '/todos', element: <TodosPage /> },
      { path: '/test-center', element: <TestCenterPage /> },
      { path: '/test-center/practice/:id', element: <PracticePage /> },
      { path: '/statistics', element: <StatisticsPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/drawer', element: <DrawerPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
