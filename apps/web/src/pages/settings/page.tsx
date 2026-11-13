import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTheme } from 'next-themes'
import {
  BadgeCheck,
  Check,
  Copy,
  ExternalLink,
  LogOut,
  Mail,
  Moon,
  Palette,
  Sun,
  TriangleAlert,
  User as UserIcon,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useThemeColor } from '@/components/theme-color-provider'
import { THEME_COLORS } from '@/lib/theme-colors'
import { assetUrl } from '@/lib/env'
import { authService } from '@/services/auth-service'
import { cn } from '@/lib/utils'

const CONTACT_EMAIL = 'dxy1848244690@gmail.com'
const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? ''

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">{children}</p>
  )
}

function MetaRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2.5 last:border-b-0">
      <span className="shrink-0 text-[12.5px] text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-[13px] text-foreground">{children}</span>
    </div>
  )
}

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()

  const { theme, setTheme } = useTheme()
  const { theme: colorTheme, setTheme: setColorTheme } = useThemeColor()

  const [mounted, setMounted] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [pending, setPending] = useState(false)

  // next-themes 的 theme 在挂载前是 undefined,直接渲染会闪一下
  useEffect(() => setMounted(true), [])

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800)
    } catch {
      // 剪贴板权限被拒时静默失败,用户还能手动选中
    }
  }

  const handleLogout = async () => {
    setPending(true)
    try {
      await authService.logout()
    } catch {
      // 接口失败也要清掉本地登录态,否则界面卡在半登录状态
    }
    setUser(null)
    setPending(false)
    setConfirmLogout(false)
    navigate('/login', { replace: true })
  }

  if (!user) return null

  const initial = (user.name ?? user.email).trim().charAt(0).toUpperCase()
  const verified = Boolean(user.emailVerifiedAt)
  const roleLabel = user.role === 'admin' ? '管理员' : '普通用户'
  const joinedAt = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    : '—'

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <header className="mb-7 border-b border-border pb-5">
        <SectionLabel>ACCOUNT</SectionLabel>
        <h1 className="mt-2 font-serif text-[26px] leading-tight tracking-tight sm:text-[28px]">
          个人设置
        </h1>
        <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
          账户信息、外观偏好,以及怎么联系作者。
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* 左列:账号 + 关于 */}
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-[16px]">账号</CardTitle>
              <CardDescription>后台登录身份,由管理员分配</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                  {user.avatarPath ? (
                    <img
                      src={assetUrl(user.avatarPath)}
                      alt={user.name ?? '头像'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="font-serif text-xl text-muted-foreground">{initial}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-serif text-[17px] leading-tight">
                      {user.name || '未设置用户名'}
                    </span>
                    {verified ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[11px] text-primary">
                        <BadgeCheck className="h-3 w-3" />
                        邮箱已验证
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                        <TriangleAlert className="h-3 w-3" />
                        邮箱未验证
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-[12.5px] text-muted-foreground">{user.email}</p>
                </div>
              </div>

              <div className="rounded-md border border-border bg-muted/20 px-3.5">
                <MetaRow label="角色">{roleLabel}</MetaRow>
                <MetaRow label="注册时间">{joinedAt}</MetaRow>
                <MetaRow label="用户 ID">
                  <button
                    type="button"
                    onClick={() => void copy(user.id, 'id')}
                    className="inline-flex max-w-full items-center gap-1.5 font-mono text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
                    title="复制用户 ID"
                  >
                    <span className="truncate">{user.id}</span>
                    {copied === 'id' ? (
                      <Check className="h-3 w-3 shrink-0 text-primary" />
                    ) : (
                      <Copy className="h-3 w-3 shrink-0" />
                    )}
                  </button>
                </MetaRow>
              </div>

              <p className="text-[11.5px] leading-5 text-muted-foreground">
                用户名、邮箱与角色由管理员在后台维护,这里只读。需要修改请通过下方邮箱联系。
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-[16px]">关于与联系</CardTitle>
              <CardDescription>遇到题目错误、想投稿,或者只是想说句话</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-border bg-muted/20 px-3.5 py-3">
                <SectionLabel>联系作者</SectionLabel>
                <div className="mt-1.5 flex flex-wrap items-center gap-3">
                  <a
                    href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('关于序言')}`}
                    className="inline-flex items-center gap-1.5 text-[13.5px] text-primary underline-offset-4 hover:underline"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {CONTACT_EMAIL}
                  </a>
                  <button
                    type="button"
                    onClick={() => void copy(CONTACT_EMAIL, 'mail')}
                    className="text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {copied === 'mail' ? '已复制' : '复制'}
                  </button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('【序言】题目纠错')}&body=${encodeURIComponent('题目链接:\n问题描述:\n')}`}
                  className="rounded-md border border-border px-3.5 py-3 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
                >
                  <span className="block text-[13px] font-medium">题目纠错</span>
                  <span className="mt-0.5 block text-[11.5px] leading-5 text-muted-foreground">
                    答案有误、表述不清,附上题目链接
                  </span>
                </a>
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('【序言】投稿')}&body=${encodeURIComponent('题目 / 主题:\n参考内容:\n')}`}
                  className="rounded-md border border-border px-3.5 py-3 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
                >
                  <span className="block text-[13px] font-medium">投稿</span>
                  <span className="mt-0.5 block text-[11.5px] leading-5 text-muted-foreground">
                    推荐题目或文章,注明来源
                  </span>
                </a>
              </div>

              <div className="rounded-md border border-border bg-muted/20 px-3.5">
                <MetaRow label="站点">
                  <span className="font-serif">序言</span>
                  <span className="ml-2 text-[11.5px] text-muted-foreground">
                    免费开放的 Web 面试题库
                  </span>
                </MetaRow>
                <MetaRow label="后台版本">
                  <span className="font-mono text-[11.5px] text-muted-foreground">
                    {APP_VERSION ? APP_VERSION.slice(0, 7) : 'dev'}
                  </span>
                </MetaRow>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右列:外观 + 会话 */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-[16px]">
                <Palette className="h-4 w-4 text-primary" />
                外观
              </CardTitle>
              <CardDescription>只影响当前浏览器</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <SectionLabel>明暗</SectionLabel>
                <div className="mt-2 grid grid-cols-3 gap-1 rounded-md border border-border p-1">
                  {[
                    { value: 'light', label: '浅色', icon: Sun },
                    { value: 'dark', label: '深色', icon: Moon },
                    { value: 'system', label: '跟随系统', icon: UserIcon },
                  ].map((opt) => {
                    const active = mounted && theme === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTheme(opt.value)}
                        className={cn(
                          'flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[12px] transition-colors',
                          active
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        <opt.icon className="h-3.5 w-3.5" />
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <SectionLabel>主题色</SectionLabel>
                <div className="mt-2 grid grid-cols-7 gap-1.5">
                  {THEME_COLORS.map((t) => {
                    const active = mounted && colorTheme === t.value
                    return (
                      <button
                        key={t.value}
                        type="button"
                        title={t.name}
                        aria-label={t.name}
                        aria-pressed={active}
                        onClick={() => setColorTheme(t.value)}
                        className={cn(
                          'mx-auto flex h-6 w-6 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-all',
                          active ? 'ring-2 ring-foreground/60' : 'opacity-80 hover:opacity-100',
                        )}
                        style={{ backgroundColor: t.color }}
                      >
                        {active ? <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} /> : null}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-2 text-[11.5px] leading-5 text-muted-foreground">
                  当前:{THEME_COLORS.find((t) => t.value === colorTheme)?.name ?? '朱砂'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-[16px]">快捷入口</CardTitle>
              <CardDescription>日常维护最常用的几个页面</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-1.5">
              {[
                { to: '/test-center', label: '题库', hint: '出题与练习' },
                ...(user.role === 'admin'
                  ? [{ to: '/review', label: '审核', hint: '人工裁决' }]
                  : []),
                { to: '/articles', label: '文章', hint: '原创与合集' },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
                >
                  <span className="text-[13px]">{item.label}</span>
                  <span className="text-[11px] text-muted-foreground">{item.hint}</span>
                </Link>
              ))}
              <a
                href="https://code.kskbl.com.cn"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
              >
                <span className="text-[13px]">前台站点</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-[16px]">会话</CardTitle>
              <CardDescription>退出后需要重新输入邮箱密码</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full justify-center text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                onClick={() => setConfirmLogout(true)}
              >
                <LogOut className="mr-2 h-4 w-4" />
                退出登录
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>退出登录?</AlertDialogTitle>
            <AlertDialogDescription>
              退出后需要重新登录才能回到后台,未保存的编辑内容会丢失。
            </AlertDialogDescription>
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
              {pending ? '退出中…' : '退出登录'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
