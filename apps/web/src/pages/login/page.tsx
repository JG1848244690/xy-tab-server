import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthAside } from '@/components/auth-aside'
import { LoginForm } from '@/components/auth/login-form'
import { RegisterForm } from '@/components/auth/register-form'

type AuthMode = 'login' | 'register'

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login')

  return (
    <div className="flex min-h-screen bg-background">
      {/* 左侧:表单 */}
      <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-[420px]">
          {/* 品牌 */}
          <Link to="/home" className="mb-12 flex items-center gap-3">
            <img src="/icon-96.png" alt="序言" className="h-8 w-8 rounded-[4px] object-cover" />
            <span className="font-serif text-xl font-semibold tracking-tight">序言</span>
            <span className="mt-0.5 font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
              ADMIN
            </span>
          </Link>

          {mode === 'login' ? (
            <LoginForm onSwitchToRegister={() => setMode('register')} />
          ) : (
            <RegisterForm
              onSwitchToLogin={() => setMode('login')}
              onRegisterSuccess={() => setMode('login')}
            />
          )}

          <p className="mt-12 border-t border-border pt-5 text-[11.5px] leading-5 text-muted-foreground">
            {mode === 'login' ? '登录' : '注册'}即表示同意
            <button className="mx-1 text-primary underline-offset-2 hover:underline">服务条款</button>
            和
            <button className="mx-1 text-primary underline-offset-2 hover:underline">隐私政策</button>
          </p>
        </div>
      </div>

      {/* 右侧:书页 aside(桌面端) */}
      <AuthAside
        title={mode === 'login' ? '欢迎回来' : '加入编务'}
        description={
          mode === 'login'
            ? '继续维护这座题库:审题、归档、写文章。'
            : '注册后即可提交题目、参与审核与内容整理。'
        }
      />
    </div>
  )
}
