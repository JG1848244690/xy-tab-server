import axios from 'axios'
import { env } from '@/lib/env'
import { useAuthStore } from '@/store/auth-store'

export const request = axios.create({
  baseURL: env.apiBase,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * 不需要登录态的页面。
 *
 * 401 的全局跳转原本只排除了 /login,结果登录页之外的两个公开页
 * 会被误伤:页面加载时 AuthBootstrap 请求 /auth/me → 401 →
 * 不管在哪个页面都跳 /login。
 *
 * 「邮箱验证」尤其致命:用户就是在未登录状态下点邮件链接进来的,
 * 一跳转就看不到验证成功了。所以这里必须是白名单,而不是排除单个路径。
 */
const PUBLIC_PATHS = ['/login', '/register', '/verify-email']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

request.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().setUser(null)
      if (typeof window !== 'undefined' && !isPublicPath(window.location.pathname)) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)
