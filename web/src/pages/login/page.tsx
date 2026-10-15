import { useState } from 'react'
import { Video } from 'lucide-react'
import { Auth3DCard } from '@/components/auth-3d-card'
import { LoginForm } from '@/components/auth/login-form'
import { RegisterForm } from '@/components/auth/register-form'

type AuthMode = 'login' | 'register'

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login')

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* 左侧表单区域 */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12">
        <div className="w-full max-w-[480px]">
          {/* Logo 区域 */}
          <div className="flex items-center gap-3 mb-12">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <Video className="w-7 h-7 text-primary" strokeWidth={2} />
            </div>
            <span className="text-xl font-bold text-foreground">Athena</span>
          </div>

          {/* 动态切换表单 */}
          <div className="transition-all duration-300 ease-in-out">
            {mode === 'login' ? (
              <LoginForm onSwitchToRegister={() => setMode('register')} />
            ) : (
              <RegisterForm
                onSwitchToLogin={() => setMode('login')}
                onRegisterSuccess={() => setMode('login')}
              />
            )}
          </div>

          {/* 底部提示 */}
          <div className="mt-12 text-center">
            <p className="text-xs text-muted-foreground">
              {mode === 'login' ? '登录' : '注册'}即表示您同意我们的
              <button className="text-primary hover:underline mx-1">服务条款</button>和
              <button className="text-primary hover:underline mx-1">隐私政策</button>
            </p>
          </div>
        </div>
      </div>

      {/* 右侧 3D 卡片 - 桌面端显示 */}
      <Auth3DCard
        title={mode === 'login' ? '欢迎回来' : '加入我们'}
        description={
          mode === 'login'
            ? '登录 Athena 学习平台，继续您的学习之旅'
            : '注册 Athena 学习平台，开启您的知识探索之旅'
        }
      />
    </div>
  )
}
