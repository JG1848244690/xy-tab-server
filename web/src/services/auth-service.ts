import { request } from '@/lib/request'
import { User } from '@/store/auth-store'

export interface LoginResponse {
  user: User
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
}
