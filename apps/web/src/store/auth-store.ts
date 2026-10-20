import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  email: string
  name?: string
  avatarPath?: string
  /** 后台权限:admin 才显示「审核工作台」;权限边界在后端 */
  role?: 'user' | 'admin'
}

interface AuthState {
  user: User | null
  setUser: (user: User | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
    }),
    {
      name: 'auth-storage', // 依然持久化 User 信息，以免刷新页面后头像消失
    }
  )
)
