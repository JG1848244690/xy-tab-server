import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { MailWarning, X } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'
import { authService } from '@/services/auth-service'

/**
 * 未验证邮箱的提醒条。
 *
 * 刻意做成「可关闭 + 不挡操作」:验证是引导,不是门禁。
 * 真正限制权限的是后端的 requireAdmin,和这条横幅无关。
 */
export function EmailVerificationBanner() {
  const user = useAuthStore((s) => s.user)
  const [dismissed, setDismissed] = useState(false)
  const [hint, setHint] = useState('')

  const resend = useMutation({
    mutationFn: async () => {
      if (user?.email) await authService.resendVerification(user.email)
    },
    onSuccess: () => setHint('已重新发送,请查收(含垃圾邮件箱)'),
    onError: () => setHint('发送失败,请稍后再试'),
  })

  // 已登录但邮箱还没验证
  if (!user || user.emailVerifiedAt || dismissed) return null

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-[12.5px]">
      <span className="flex items-center gap-2 text-foreground">
        <MailWarning className="h-4 w-4 text-primary" />
        邮箱尚未验证
        <span className="text-muted-foreground">{user.email}</span>
      </span>

      <button
        type="button"
        onClick={() => resend.mutate()}
        disabled={resend.isPending}
        className="text-primary underline-offset-2 hover:underline disabled:opacity-60"
      >
        {resend.isPending ? '发送中…' : '重新发送验证邮件'}
      </button>

      {hint ? <span className="text-muted-foreground">{hint}</span> : null}

      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ml-auto rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
        aria-label="关闭提醒"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
