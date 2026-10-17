import { useEffect, useState } from 'react'
import { authService } from '@/services/auth-service'
import { useAuthStore } from '@/store/auth-store'

/**
 * 替代原 Next 根 layout 的 SSR 取用户逻辑。
 * 放在 RouterProvider 外层:先确定登录态,再渲染任何路由,避免"先闪一下 dashboard 再跳登录"。
 * 注意 auth-store 用了 persist,刷新时 localStorage 里已有 user,这里只是拿服务端真值校准。
 */
export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    authService
      .me()
      .then((u) => alive && setUser(u))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [setUser])

  if (!ready) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }
  return <>{children}</>
}
