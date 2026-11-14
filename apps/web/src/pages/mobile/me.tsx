import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from 'next-themes'
import { BadgeCheck, ChevronRight, Loader2, LogOut, Monitor, Moon, Sun, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAuthStore } from '@/store/auth-store'
import { authService } from '@/services/auth-service'
import { cn } from '@/lib/utils'

const CONTACT_EMAIL = 'dxy1848244690@gmail.com'

export default function MobileMe() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()

  const [mounted, setMounted] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => setMounted(true), [])

  const handleLogout = async () => {
    setPending(true)
    try {
      await authService.logout()
    } catch {
      // 接口失败也清本地状态
    }
    setUser(null)
    setPending(false)
    setConfirmLogout(false)
    navigate('/login', { replace: true })
  }

  if (!user) return null

  const initial = (user.name ?? user.email).trim().charAt(0).toUpperCase()
  const verified = Boolean(user.emailVerifiedAt)

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-6 pt-4">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
          <span className="font-serif text-lg text-muted-foreground">{initial}</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-serif text-[16px]">{user.name || '未设置用户名'}</span>
            {verified ? (
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
            ) : (
              <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            )}
          </div>
          <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <section className="mt-4">
        <p className="mb-2 font-mono text-[10px] tracking-[0.16em] text-muted-foreground">外观</p>
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-border p-1">
          {[
            { value: 'light', label: '浅色', icon: Sun },
            { value: 'dark', label: '深色', icon: Moon },
            { value: 'system', label: '跟随系统', icon: Monitor },
          ].map((opt) => {
            const active = mounted && theme === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                className={cn(
                  'flex items-center justify-center gap-1 rounded px-2 py-2 text-[12px] transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground active:bg-muted',
                )}
              >
                <opt.icon className="h-3.5 w-3.5" />
                {opt.label}
              </button>
            )
          })}
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-lg border border-border">
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('关于序言')}`}
          className="flex items-center justify-between border-b border-border px-4 py-3 text-[13.5px] active:bg-muted/50"
        >
          <span>联系作者</span>
          <span className="text-[11.5px] text-muted-foreground">{CONTACT_EMAIL}</span>
        </a>
        <button
          type="button"
          onClick={() => navigate('/home')}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-[13.5px] active:bg-muted/50"
        >
          <span>切换到桌面版</span>
          <span className="flex items-center text-[11.5px] text-muted-foreground">
            编辑 / 审核
            <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
          </span>
        </button>
      </section>

      <Button
        variant="outline"
        className="mt-4 h-11 w-full text-muted-foreground hover:border-destructive/40 hover:text-destructive"
        onClick={() => setConfirmLogout(true)}
      >
        <LogOut className="mr-2 h-4 w-4" />
        退出登录
      </Button>

      <p className="mt-6 text-center text-[11px] leading-5 text-muted-foreground">
        手机上只保留「看题 + 刷题 + 账号」。
        <br />
        出题、审核、绘图请用电脑打开。
      </p>

      <AlertDialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>退出登录?</AlertDialogTitle>
            <AlertDialogDescription>退出后需要重新登录才能继续刷题。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault()
                void handleLogout()
              }}
            >
              {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              退出登录
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
