import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, MailCheck, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authService } from '@/services/auth-service'
import { useAuthStore } from '@/store/auth-store'

type State =
    | { kind: 'verifying' }
    | { kind: 'success'; alreadyVerified: boolean }
    | { kind: 'error'; message: string }

/**
 * 邮件里那条链接的落地页:/verify-email?token=xxx
 *
 * 为什么链接不直接打到 API:
 *   1. API 返回 JSON,用户点开看到一坨 JSON 很怪
 *   2. 验证成功后要落到前端界面(并顺手刷新登录态),展示归前端
 *   3. 同一个页面可以处理「已过期 / 已用过 / 设备不同」各种分支
 */
export default function VerifyEmailPage() {
    const [state, setState] = useState<State>({ kind: 'verifying' })
    const navigate = useNavigate()
    const setUser = useAuthStore((s) => s.setUser)
    const user = useAuthStore((s) => s.user)
    // React 18 StrictMode 下 effect 会跑两次,用 ref 保证只提交一次
    const submitted = useRef(false)

    useEffect(() => {
        if (submitted.current) return
        submitted.current = true

        const token = new URLSearchParams(window.location.search).get('token')
        if (!token) {
            setState({ kind: 'error', message: '链接不完整,请回到邮件重新点一次。' })
            return
        }

        authService
            .verifyEmail(token)
            .then((res) => {
                // 如果当前就登录着同一个账号,顺手把本地用户信息刷新掉,
                // 免得界面还显示「未验证」
                if (user?.id === res.user.id) setUser(res.user)
                setState({ kind: 'success', alreadyVerified: res.alreadyVerified })
            })
            .catch((err) => {
                const msg =
                    err?.response?.data?.message ?? '验证失败,链接可能已过期。'
                setState({
                    kind: 'error',
                    message:
                        msg === 'Invalid or expired token'
                            ? '这个链接无效或已过期。回到后台重新发一封即可。'
                            : msg,
                })
            })
    }, [setUser, user?.id])

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
            <div className="w-full max-w-[420px]">
                <Link to="/home" className="mb-10 flex items-center gap-3">
                    <img src="/icon-96.png" alt="序言" className="h-8 w-8 rounded-[4px] object-cover" />
                    <span className="font-serif text-xl font-semibold tracking-tight">序言</span>
                    <span className="mt-0.5 font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
                        ADMIN
                    </span>
                </Link>

                {state.kind === 'verifying' ? (
                    <div className="flex items-center gap-3 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <p className="text-sm">正在验证…</p>
                    </div>
                ) : null}

                {state.kind === 'success' ? (
                    <div className="space-y-5">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background">
                                <MailCheck className="h-5 w-5 text-primary" />
                            </span>
                            <h1 className="text-2xl font-bold text-foreground">
                                {state.alreadyVerified ? '邮箱已验证' : '验证成功'}
                            </h1>
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">
                            {state.alreadyVerified
                                ? '这个邮箱之前已经验证过了,不用重复操作。'
                                : '邮箱已验证,现在可以用它登录后台了。'}
                        </p>
                        <Button className="w-full h-11" onClick={() => navigate(user ? '/home' : '/login')}>
                            {user ? '回到后台' : '去登录'}
                        </Button>
                    </div>
                ) : null}

                {state.kind === 'error' ? (
                    <div className="space-y-5">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background">
                                <TriangleAlert className="h-5 w-5 text-destructive" />
                            </span>
                            <h1 className="text-2xl font-bold text-foreground">验证没完成</h1>
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">{state.message}</p>
                        <Button variant="outline" className="w-full h-11" onClick={() => navigate('/login')}>
                            回到登录页
                        </Button>
                    </div>
                ) : null}
            </div>
        </div>
    )
}
