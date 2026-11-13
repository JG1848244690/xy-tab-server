import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, MailCheck, RefreshCw } from 'lucide-react'
import { request } from '@/lib/request'
import { authService } from '@/services/auth-service'

declare global {
    interface Window {
        turnstile?: {
            render: (
                el: HTMLElement,
                opts: {
                    sitekey: string
                    callback: (token: string) => void
                    'expired-callback'?: () => void
                    theme?: 'light' | 'dark' | 'auto'
                },
            ) => string
            reset: () => void
        }
    }
}

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

type CaptchaMode = 'checking' | 'turnstile' | 'local' | 'off'

interface LocalChallenge {
    id: string
    question: string
    sig: string
    expiresAt: number
}

/** Turnstile 加载不出来时的本地兜底:服务端下发的算术题 */
function LocalChallengeBox({
    challenge,
    answer,
    loading,
    error,
    onAnswer,
    onRefresh,
}: {
    challenge: LocalChallenge | null
    answer: string
    loading: boolean
    error: string | null
    onAnswer: (v: string) => void
    onRefresh: () => void
}) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <p className="font-mono text-[10.5px] tracking-[0.12em] text-muted-foreground">
                    人机验证
                </p>
                <button
                    type="button"
                    onClick={onRefresh}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                >
                    <RefreshCw className={loading ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} />
                    换一题
                </button>
            </div>
            <div className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2">
                <span className="font-mono text-sm tabular-nums">
                    {challenge ? challenge.question : '加载中…'}
                </span>
                <Input
                    value={answer}
                    onChange={(e) => onAnswer(e.target.value)}
                    inputMode="numeric"
                    placeholder="答案"
                    className="h-8 max-w-24"
                />
            </div>
            <p className="text-[11px] leading-5 text-muted-foreground">
                当前网络加载不到 Cloudflare 验证,已切换为本地验证。
                {error ? <span className="text-destructive"> {error}</span> : null}
            </p>
        </div>
    )
}

interface RegisterFormProps {
    onSwitchToLogin: () => void
    onRegisterSuccess: () => void
}

export function RegisterForm({ onSwitchToLogin, onRegisterSuccess }: RegisterFormProps) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [error, setError] = useState('')

    /** 注册成功后停在这一步:等用户去邮箱点链接 */
    const [sentTo, setSentTo] = useState<string | null>(null)
    const [resendCooldown, setResendCooldown] = useState(0)
    const [resendHint, setResendHint] = useState('')

    /** Turnstile token(正常网络) */
    const [turnstileToken, setTurnstileToken] = useState('')
    /** 本地算术题(国内兜底) */
    const [challenge, setChallenge] = useState<LocalChallenge | null>(null)
    const [challengeAnswer, setChallengeAnswer] = useState('')
    const [challengeError, setChallengeError] = useState<string | null>(null)
    const [captchaMode, setCaptchaMode] = useState<CaptchaMode>(
        TURNSTILE_SITE_KEY ? 'checking' : 'off',
    )

    const turnstileRef = useRef<HTMLDivElement>(null)
    const renderedRef = useRef(false)

    const loadChallenge = useCallback(async () => {
        setChallengeError(null)
        try {
            const res = await request.get<LocalChallenge>('/auth/challenge')
            setChallenge(res.data)
            setChallengeAnswer('')
        } catch {
            setChallengeError('验证题加载失败,请刷新页面重试')
        }
    }, [])

    /** 切到本地验证 */
    const useLocal = useCallback(() => {
        setCaptchaMode('local')
        void loadChallenge()
    }, [loadChallenge])

    useEffect(() => {
        if (!TURNSTILE_SITE_KEY) return
        if (captchaMode !== 'checking') return

        let stop = false
        let timer: ReturnType<typeof setInterval> | undefined
        const deadline = Date.now() + 6000

        const tryRender = () => {
            if (stop) return
            const el = turnstileRef.current
            if (renderedRef.current) return

            if (!window.turnstile) {
                if (Date.now() > deadline) {
                    stop = true
                    if (timer) clearInterval(timer)
                    // 6 秒还没加载出来,基本就是被墙/被拦 → 本地验证
                    useLocal()
                }
                return
            }

            if (!el) return
            try {
                const dark = document.documentElement.classList.contains('dark')
                window.turnstile.render(el, {
                    sitekey: TURNSTILE_SITE_KEY,
                    callback: (token) => {
                        setTurnstileToken(token)
                        setCaptchaMode('turnstile')
                    },
                    'expired-callback': () => setTurnstileToken(''),
                    theme: dark ? 'dark' : 'light',
                })
                renderedRef.current = true
                setCaptchaMode('turnstile')
                if (timer) clearInterval(timer)
            } catch {
                useLocal()
            }
        }

        tryRender()
        timer = setInterval(tryRender, 300)

        return () => {
            stop = true
            if (timer) clearInterval(timer)
        }
    }, [captchaMode, useLocal])

    const registerMutation = useMutation({
        mutationFn: async () => {
            const res = await request.post('/auth/register', {
                email,
                password,
                name,
                turnstileToken: turnstileToken || undefined,
                challenge: challenge
                    ? {
                          id: challenge.id,
                          answer: challengeAnswer.trim(),
                          sig: challenge.sig,
                          expiresAt: challenge.expiresAt,
                      }
                    : undefined,
            })
            return res.data
        },
        onSuccess: () => {
            // 不再直接切回登录:先让用户去邮箱点验证链接
            setSentTo(email)
            setResendCooldown(60)
            setResendHint('')
        },
        onError: (err: any) => {
            const code = err.response?.data?.code
            setError(err.response?.data?.message || '注册失败,请重试')
            // token/题目失效都重置一次,让用户重来
            setTurnstileToken('')
            window.turnstile?.reset()
            if (code === 'TURNSTILE_FAILED' && captchaMode === 'local') void loadChallenge()
        },
    })

    /** 倒计时:让「重新发送」按钮在 60 秒内不可点,和后端冷却对齐 */
    useEffect(() => {
        if (resendCooldown <= 0) return
        const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000)
        return () => clearTimeout(t)
    }, [resendCooldown])

    const resendMutation = useMutation({
        mutationFn: async () => {
            if (!sentTo) return
            await authService.resendVerification(sentTo)
        },
        onSuccess: () => {
            setResendCooldown(60)
            setResendHint('已重新发送,请查收(含垃圾邮件箱)')
        },
        onError: () => {
            setResendHint('发送失败,请稍后再试')
        },
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        registerMutation.mutate()
    }

    const captchaReady =
        captchaMode === 'off' ||
        (captchaMode === 'turnstile' && !!turnstileToken) ||
        (captchaMode === 'local' && !!challenge && challengeAnswer.trim().length > 0)

    return (
        <div className="w-full max-w-md mx-auto">
            {sentTo ? (
                <div className="space-y-5">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background">
                            <MailCheck className="h-5 w-5 text-primary" />
                        </span>
                        <h1 className="text-2xl font-bold text-foreground">去邮箱完成验证</h1>
                    </div>

                    <p className="text-sm leading-6 text-muted-foreground">
                        验证邮件已发送到{' '}
                        <span className="font-medium text-foreground">{sentTo}</span>
                        。点邮件里的按钮即完成验证,然后回来登录。
                    </p>

                    <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-[12px] leading-5 text-muted-foreground">
                        没收到?先看垃圾邮件箱。邮件可能需要一两分钟。
                        {import.meta.env.DEV ? (
                            <span className="mt-1 block text-[11px]">
                                本地开发:未配置 SMTP,验证链接会打印在 API 控制台(搜索
                                <code className="mx-1 rounded bg-background px-1">[mail:log]</code>)。
                            </span>
                        ) : null}
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        className="w-full h-11"
                        disabled={resendCooldown > 0 || resendMutation.isPending}
                        onClick={() => resendMutation.mutate()}
                    >
                        {resendMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {resendCooldown > 0 ? `${resendCooldown}s 后可重新发送` : '重新发送验证邮件'}
                    </Button>

                    {resendHint ? (
                        <p className="text-center text-[12px] text-muted-foreground">{resendHint}</p>
                    ) : null}

                    <div className="text-center text-sm text-muted-foreground">
                        已经验证过了?{' '}
                        <button
                            type="button"
                            onClick={onRegisterSuccess}
                            className="text-primary hover:underline font-medium transition-colors"
                        >
                            去登录
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-foreground mb-2">创建新账号</h1>
                        <p className="text-muted-foreground text-sm">填写以下信息以创建您的账号</p>
                    </div>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                        placeholder="至少 8 位密码"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        className="h-11 bg-background"
                    />
                </div>

                {/* 人机验证:Turnstile 优先,失败自动切本地算术题 */}
                {TURNSTILE_SITE_KEY ? (
                    <>
                        <div className={captchaMode === 'local' ? 'hidden' : ''}>
                            <p className="mb-2 font-mono text-[10.5px] tracking-[0.12em] text-muted-foreground">
                                人机验证
                            </p>
                            <div
                                ref={turnstileRef}
                                className="min-h-[65px] overflow-hidden rounded-md border border-border bg-background p-1"
                            />
                            {captchaMode === 'checking' ? (
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                    正在加载验证组件…
                                </p>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => useLocal()}
                                    className="mt-1 text-[11px] text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
                                >
                                    加载不出来?改用手动验证
                                </button>
                            )}
                        </div>

                        {captchaMode === 'local' ? (
                            <LocalChallengeBox
                                challenge={challenge}
                                answer={challengeAnswer}
                                loading={!challenge && !challengeError}
                                error={challengeError}
                                onAnswer={setChallengeAnswer}
                                onRefresh={() => void loadChallenge()}
                            />
                        ) : null}
                    </>
                ) : null}

                <Button
                    type="submit"
                    className="w-full h-11 text-base font-medium"
                    disabled={registerMutation.isPending || !captchaReady}
                >
                    {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    注册
                </Button>

                <div className="text-center text-sm text-muted-foreground pt-2">
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
                </>
            )}
        </div>
    )
}
