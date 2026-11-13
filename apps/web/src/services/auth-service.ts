import { request } from '@/lib/request'
import { User } from '@/store/auth-store'

export interface LoginResponse {
  user: User
}

export interface VerifyEmailResponse {
  user: User
  /** true = 之前就验证过(重复点链接 / 刷新页面),当成功处理即可 */
  alreadyVerified: boolean
}

export const authService = {
  login: async (email: string, password: string): Promise<User> => {
    const response = await request.post<LoginResponse>('/auth/login', {
      email,
      password,
    })
    return response.data.user
  },

  logout: async (): Promise<void> => {
    await request.post('/auth/logout')
  },

  me: async (): Promise<User> => {
    const response = await request.get<User>('/auth/me')
    return response.data
  },

  /** 注册后带着 token 回来验证邮箱 */
  verifyEmail: async (token: string): Promise<VerifyEmailResponse> => {
    const response = await request.post<VerifyEmailResponse>('/auth/email/verify', { token })
    return response.data
  },

  /** 重发验证邮件;后端永远返回同一句话,不透露邮箱是否存在 */
  resendVerification: async (email: string): Promise<void> => {
    await request.post('/auth/email/resend', { email })
  },
}
