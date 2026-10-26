import { useQuery, useMutation, useQueryClient, useIsFetching } from '@tanstack/react-query'
import { useState } from 'react'
import {
    ShieldCheck,
    ChevronDown,
    CircleAlert,
    CircleCheck,
    CircleX,
    Circle,
    Sparkles,
    RefreshCw,
    Wand2,
    RotateCw,
    Loader2,
    Clock,
} from 'lucide-react'
import { reviewApi, type ReviewQueueItem, type ReviewQueueFilter } from '@/services/review-api'
import { useAuthStore } from '@/store/auth-store'
import { QuotaBadge } from '@/components/ai-quota-badge'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * 审核中心(仅 admin 可见,见 dashboard-nav 的显隐 + 后端 403 兜底)
 *
 * 2026-10-26 改版:四个 tab → 单列表 + 状态筛选,
 * 每行用四步进度展示:AI 审核中 → AI 审核通过 → 待人工审核 → 已通过。
 * 排序由后端保证:待人工 > 审核中 > 未通过 > 已通过。
 */

const FILTERS: Array<{ value: ReviewQueueFilter; label: string }> = [
    { value: 'all', label: '全部' },
    { value: 'reviewing', label: 'AI 审核中' },
    { value: 'pending', label: '待人工审核' },
    { value: 'rejected', label: '未通过' },
    { value: 'approved', label: '已通过' },
]

const STEP_LABELS = ['AI 审核中', 'AI 审核通过', '待人工审核', '已通过'] as const

type StepState = 'done' | 'active' | 'failed' | 'todo'

/**
 * 状态 → 四步进度。
 * 注意:人工驳回(已通过的题被人工打回)时,失败的是「待人工审核」这一步,
 * 不能笼统标成 AI 未通过。
 */
function stepStates(item: ReviewQueueItem): StepState[] {
    const humanRejected =
        item.latestLog?.source === 'human' && item.latestLog.verdict === 'rejected'
    switch (item.status) {
        case 'pending_review':
            return ['active', 'todo', 'todo', 'todo']
        case 'human_pending':
            return ['done', 'done', 'active', 'todo']
        case 'approved':
            return ['done', 'done', 'done', 'done']
        case 'rejected':
            return humanRejected
                ? ['done', 'done', 'failed', 'todo']
                : ['done', 'failed', 'todo', 'todo']
        default:
            // draft:已创建、还没送审
            return ['todo', 'todo', 'todo', 'todo']
    }
}

function StepProgress({ item }: { item: ReviewQueueItem }) {
    const states = stepStates(item)
    return (
        <div className="flex flex-wrap items-center gap-y-1">
            {STEP_LABELS.map((label, i) => {
                const state = states[i]
                const icon =
                    state === 'done' ? (
                        <CircleCheck className="h-3.5 w-3.5" />
                    ) : state === 'active' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : state === 'failed' ? (
                        <CircleX className="h-3.5 w-3.5" />
                    ) : (
                        <Circle className="h-3.5 w-3.5" />
                    )
                return (
                    <div key={label} className="flex items-center">
                        <span
                            className={cn(
                                'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-none',
                                state === 'done' &&
                                    'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300',
                                state === 'active' &&
                                    'border-blue-200 bg-blue-50 font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300',
                                state === 'failed' &&
                                    'border-red-200 bg-red-50 font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
                                state === 'todo' &&
                                    'border-muted bg-muted/40 text-muted-foreground',
                            )}
                        >
                            {icon}
                            {label}
                        </span>
                        {i < STEP_LABELS.length - 1 && (
                            <span
                                className={cn(
                                    'mx-1 h-px w-3 sm:w-5',
                                    states[i] === 'done' && states[i + 1] !== 'todo'
                                        ? 'bg-green-300 dark:bg-green-800'
                                        : 'bg-border',
                                )}
                            />
                        )}
                    </div>
                )
            })}
        </div>
    )
}

/** AI 报告渲染:五维 + 建议 + 口诀 + 改进版预览 */
function ReportPanel({ item }: { item: ReviewQueueItem }) {
    const r = item.reviewResult
    if (!r) return null

    // agent 失败的报告只有 error 字段
    if (r.error) {
        return (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <CircleAlert className="h-4 w-4 flex-none" />
                AI 审核失败:{r.error}
            </div>
        )
    }

    const dims = r.dimensions ?? {}
    const dimList = Object.entries(dims) as Array<[string, number]>

    return (
        <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                AI 总分
                <span className="font-mono text-base font-semibold text-foreground">
                    {item.reviewScore}
                </span>
                {item.reviewScore !== null && item.reviewScore >= 85 && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        高置信
                    </span>
                )}
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-5">
                {dimList.map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between gap-2 rounded-md bg-muted px-2.5 py-1">
                        <span className="text-xs text-muted-foreground">{key}</span>
                        <span className="font-mono text-xs font-semibold">{val}</span>
                    </div>
                ))}
            </div>
            {r.oneLiner && (
                <p className="text-[13px] text-muted-foreground">
                    一句话答案:{r.oneLiner}
                </p>
            )}
            {r.mnemonic && (
                <p className="text-[13px] text-muted-foreground">记忆口诀:{r.mnemonic}</p>
            )}
            {r.suggestions?.length ? (
                <div className="rounded-md bg-muted px-3 py-2">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">修改建议</p>
                    <ul className="list-disc space-y-1 pl-4 text-[13px]">
                        {r.suggestions.map((s, i) => (
                            <li key={i}>{s}</li>
                        ))}
                    </ul>
                </div>
            ) : null}
            {r.revised ? (
                <div className="rounded-md border px-3 py-2">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary">
                        <Wand2 className="h-3.5 w-3.5" />
                        AI 改进版(可直接一键应用,应用后自动重审)
                    </p>
                    {r.revised.title ? (
                        <p className="mb-1 text-[13px] font-semibold">{r.revised.title}</p>
                    ) : null}
                    <div className="max-h-56 space-y-2 overflow-y-auto pr-1 text-[13px]">
                        <div>
                            <span className="text-xs text-muted-foreground">题干</span>
                            <pre className="mt-0.5 whitespace-pre-wrap break-words font-sans">
                                {r.revised.content}
                            </pre>
                        </div>
                        <div>
                            <span className="text-xs text-muted-foreground">答案</span>
                            <pre className="mt-0.5 whitespace-pre-wrap break-words font-sans">
                                {r.revised.answer}
                            </pre>
                        </div>
                    </div>
                    {r.revised.tags?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                            {r.revised.tags.map((t, i) => (
                                <span
                                    key={i}
                                    className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                >
                                    {t}
                                </span>
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    )
}

function QueueItemCard({ item }: { item: ReviewQueueItem }) {
    const queryClient = useQueryClient()
    const [reportOpen, setReportOpen] = useState(
        item.status === 'human_pending' || item.status === 'rejected',
    )
    const [rejectOpen, setRejectOpen] = useState(false)
    const [note, setNote] = useState('')
    const [tip, setTip] = useState<string | null>(null)

    const invalidate = () => {
        void queryClient.invalidateQueries({ queryKey: ['review-queue'] })
        void queryClient.invalidateQueries({ queryKey: ['ai-quota'] })
    }

    const human = useMutation({
        mutationFn: (args: { decision: 'approve' | 'reject'; note?: string }) =>
            reviewApi.human(item.id, args.decision, args.note),
        onSuccess: () => {
            invalidate()
            setRejectOpen(false)
            setNote('')
        },
    })

    // 一键应用 AI 改进版 → 写回原题 + 自动重审
    const applyRevised = useMutation({
        mutationFn: () => reviewApi.applyRevision(item.id),
        onSuccess: (res) => {
            setTip(res.queued ? '已应用 AI 改进版,正在重审…' : '改进版已写回,审核 agent 正忙,稍后请手动重试')
            invalidate()
        },
        onError: (err) => setTip(err instanceof Error ? err.message : '应用失败'),
    })

    // 原题重触发(内容改过 / 想再跑一次 / 卡死兜底)
    const retrigger = useMutation({
        mutationFn: () => reviewApi.trigger(item.id),
        onSuccess: (res) => {
            if (res.status === 'skipped') {
                setTip('内容与上次一致,审核结果未变;请先修改内容或应用 AI 改进版')
            } else {
                setTip('已重新提交审核…')
            }
            invalidate()
        },
        onError: (err) => setTip(err instanceof Error ? err.message : '触发失败'),
    })

    const busy = human.isPending || applyRevised.isPending || retrigger.isPending
    const hasRevised = Boolean(
        item.reviewResult?.revised?.content && item.reviewResult.revised.answer,
    )
    const canRetry = ['draft', 'pending_review', 'rejected'].includes(item.status)

    return (
        <div className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-semibold">{item.title}</h3>
                    <div className="mt-2">
                        <StepProgress item={item} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {item.reviewScore !== null ? (
                            <span className="font-mono">AI {item.reviewScore} 分</span>
                        ) : (
                            <span>尚未评分</span>
                        )}
                        <span>·</span>
                        <span>
                            {item.latestLog
                                ? new Date(item.latestLog.createdAt).toLocaleString('zh-CN')
                                : '-'}
                        </span>
                        {item.latestLog?.note ? <span>· 备注:{item.latestLog.note}</span> : null}
                    </div>
                </div>
                <div className="flex flex-none flex-wrap items-center justify-end gap-2">
                    {item.reviewResult && !item.reviewResult.error ? (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setReportOpen((v) => !v)}
                        >
                            AI 报告
                            <ChevronDown
                                className={`h-4 w-4 transition-transform ${reportOpen ? 'rotate-180' : ''}`}
                            />
                        </Button>
                    ) : null}
                    {item.status === 'human_pending' ? (
                        <>
                            <Button
                                size="sm"
                                disabled={busy}
                                onClick={() => human.mutate({ decision: 'approve' })}
                            >
                                <CircleCheck className="h-4 w-4" />
                                通过并发布
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                disabled={busy}
                                onClick={() => setRejectOpen(true)}
                            >
                                <CircleAlert className="h-4 w-4" />
                                驳回
                            </Button>
                        </>
                    ) : null}
                    {item.status === 'rejected' ? (
                        <>
                            {hasRevised ? (
                                <Button
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => applyRevised.mutate()}
                                >
                                    {applyRevised.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Wand2 className="h-4 w-4" />
                                    )}
                                    一键应用 AI 改进版并重审
                                </Button>
                            ) : null}
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => human.mutate({ decision: 'approve' })}
                            >
                                不认同,强行通过
                            </Button>
                        </>
                    ) : null}
                    {canRetry ? (
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => retrigger.mutate()}
                        >
                            {retrigger.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <RotateCw className="h-4 w-4" />
                            )}
                            {item.status === 'pending_review' ? '重新提交' : '重新审核'}
                        </Button>
                    ) : null}
                </div>
            </div>

            {tip ? <p className="mt-2 text-xs text-primary">{tip}</p> : null}

            {item.status === 'pending_review' ? (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    AI 正在审核,完成后自动进入「待人工审核」或「未通过」;列表会自动刷新
                </p>
            ) : null}

            {reportOpen && item.reviewResult && (
                <div className="mt-3 border-t pt-3">
                    <ReportPanel item={item} />
                </div>
            )}

            {/* 驳回理由对话框:必填,后端同样强校验 */}
            <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>驳回「{item.title}」</DialogTitle>
                        <DialogDescription>
                            驳回后题目回到 rejected 状态;创建者修改内容后才能重新提交审核。
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="驳回理由(必填,会展示给出题人)"
                        rows={3}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectOpen(false)}>
                            取消
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={!note.trim() || human.isPending}
                            onClick={() => human.mutate({ decision: 'reject', note: note.trim() })}
                        >
                            确认驳回
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default function ReviewPage() {
    const role = useAuthStore((s) => s.user?.role)
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState<ReviewQueueFilter>('all')
    const [page, setPage] = useState(1)
    // 任一队列请求在飞 → 刷新按钮转圈且禁用(防连点)
    const fetching = useIsFetching({ queryKey: ['review-queue'] }) > 0

    const { data, isLoading } = useQuery({
        queryKey: ['review-queue', filter, page],
        queryFn: () => reviewApi.queue(filter, page),
        // 审核状态变化快(agent 异步写库),不能吃全局 60s 缓存
        staleTime: 0,
        refetchOnMount: 'always',
        // 列表里只要还有「AI 审核中」的题,就 4s 轮询一次
        refetchInterval: (query) =>
            query.state.data?.data.some((i) => i.status === 'pending_review') ? 4000 : false,
    })

    // 权限边界在后端;这里只是导航显隐的兜底
    if (role !== 'admin') {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="text-lg">需要管理员权限</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        审核中心仅对 admin 开放。
                    </p>
                </div>
            </div>
        )
    }

    const counts = data?.counts
    const total = data?.total ?? 0
    const totalPages = Math.max(1, Math.ceil(total / (data?.size ?? 20)))
    const items = data?.data ?? []

    return (
        <div className="flex h-full flex-col overflow-hidden">
            <div className="border-b px-6 pb-4 pt-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-bold">审核</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            出题 → AI 前置审核 → 人工裁决 → 发布。新题先进这里,通过后才出现在题库。
                        </p>
                    </div>
                    <div className="flex flex-none items-center gap-2">
                        <QuotaBadge />
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={fetching}
                            onClick={() =>
                                void queryClient.invalidateQueries({ queryKey: ['review-queue'] })
                            }
                        >
                            <RefreshCw className={`h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />
                            刷新
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {/* 状态筛选(带各状态数量) */}
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    {FILTERS.map((f) => {
                        const active = filter === f.value
                        const count = counts?.[f.value] ?? 0
                        return (
                            <Button
                                key={f.value}
                                variant={active ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => {
                                    setFilter(f.value)
                                    setPage(1)
                                }}
                            >
                                {f.label}
                                <span
                                    className={cn(
                                        'ml-1.5 rounded-full px-1.5 py-0.5 font-mono text-[10px] leading-none',
                                        active ? 'bg-primary-foreground/20' : 'bg-muted',
                                    )}
                                >
                                    {count}
                                </span>
                            </Button>
                        )
                    })}
                </div>

                {isLoading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                        {filter === 'all'
                            ? '还没有提交审核的题目'
                            : `当前没有「${FILTERS.find((f) => f.value === filter)?.label}」的题目`}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map((item) => (
                            <QueueItemCard key={item.id} item={item} />
                        ))}
                    </div>
                )}

                {total > 0 && (
                    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                        <span>共 {total} 条</span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                上一页
                            </Button>
                            <span className="font-mono text-xs">
                                {page} / {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= totalPages}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                下一页
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
