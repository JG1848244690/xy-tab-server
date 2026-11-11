import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth-store'
import { useNavigate } from 'react-router-dom'
import { authService } from '@/services/auth-service'
import { useState, useRef, useEffect } from 'react'
import { Settings, LogOut } from 'lucide-react'
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

import { assetUrl } from '@/lib/env'

export function UserNav() {
  const { user, setUser } = useAuthStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [pending, setPending] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    setPending(true)
    try {
      await authService.logout()
    } catch {
      // 忽略错误:即使接口失败,本地也要清掉登录态
    }
    setUser(null)
    setPending(false)
    setConfirmLogout(false)
    navigate('/login', { replace: true })
  }

  return (
    <div className="relative" ref={menuRef}>
      <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setOpen(!open)}>
        {user?.avatarPath ? (
          <img
            src={assetUrl(user.avatarPath)}
            alt="Avatar"
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-border">
            <span className="text-xs font-medium">{user?.name?.[0]?.toUpperCase() || 'U'}</span>
          </div>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-48 rounded-md border border-border bg-popover p-1.5 shadow-lg">
          <div className="border-b border-border px-2.5 py-2">
            <p className="truncate text-[13px] font-medium">{user?.name || '未命名'}</p>
            <p className="truncate font-mono text-[10.5px] text-muted-foreground">{user?.email}</p>
          </div>
          <button
            className="mt-1 flex w-full items-center gap-2 rounded px-2.5 py-2 text-sm transition-colors hover:bg-accent"
            onClick={() => {
              setOpen(false)
              navigate('/settings')
            }}
          >
            <Settings className="h-4 w-4" />
            个人设置
          </button>
          <button
            className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
            onClick={() => {
              setOpen(false)
              setConfirmLogout(true)
            }}
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </div>
      )}

      <AlertDialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>退出登录?</AlertDialogTitle>
            <AlertDialogDescription>
              退出后需要重新输入邮箱和密码才能回到后台。未保存的内容会丢失。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending} autoFocus>
              取消
            </AlertDialogCancel>
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
