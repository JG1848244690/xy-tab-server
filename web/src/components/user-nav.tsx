import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth-store'
import { useNavigate } from 'react-router-dom'
import { authService } from '@/services/auth-service'
import { useState, useRef, useEffect } from 'react'
import { Settings, LogOut } from 'lucide-react'

import { assetUrl } from '@/lib/env'

export function UserNav() {
  const { user, setUser } = useAuthStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
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
    try {
      await authService.logout()
    } catch {
      // 忽略错误
    }
    setUser(null)
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
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-xs font-bold">{user?.name?.[0]?.toUpperCase() || 'U'}</span>
          </div>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 rounded-md border bg-background shadow-lg z-50">
          <div className="p-2">
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-md"
              onClick={() => {
                setOpen(false)
                navigate('/settings')
              }}
            >
              <Settings className="h-4 w-4" />
              个人设置
            </button>
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent rounded-md"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              退出登录
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
