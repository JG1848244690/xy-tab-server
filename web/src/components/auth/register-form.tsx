import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { request } from '@/lib/request'

interface RegisterFormProps {
  onSwitchToLogin: () => void
  onRegisterSuccess: () => void
}

export function RegisterForm({ onSwitchToLogin, onRegisterSuccess }: RegisterFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const registerMutation = useMutation({
    mutationFn: async () => {
      const res = await request.post('/auth/register', { email, password, name })
      return res.data
    },
    onSuccess: () => {
      onRegisterSuccess()
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || '注册失败，请重试')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    registerMutation.mutate()
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">创建新账号</h1>
        <p className="text-muted-foreground text-sm">填写以下信息以创建您的账号</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium text-foreground">
            用户名
          </Label>
          <Input
            id="name"
            type="text"
            placeholder="请输入用户名"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="h-11 bg-background"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-foreground">
            邮箱
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11 bg-background"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium text-foreground">
            密码
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="至少6位密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="h-11 bg-background"
          />
        </div>

        <Button
          type="submit"
          className="w-full h-11 text-base font-medium"
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          注册
        </Button>

        <div className="text-center text-sm text-muted-foreground pt-4">
          已有账号？{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-primary hover:underline font-medium transition-colors"
          >
            立即登录
          </button>
        </div>
      </form>
    </div>
  )
}
