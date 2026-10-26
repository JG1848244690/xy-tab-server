import { useQuery, useMutation, useQueryClient, useIsFetching } from '@tanstack/react-query'
import { useState } from 'react'
import {
    ShieldCheck,
    ChevronDown,
    CircleAlert,
    CircleCheck,
    Sparkles,
    RefreshCw,
    Wand2,
    RotateCw,
    Loader2,
    Clock,
    FileText,
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
 * 审核中心(仅 admin)
 *
 * 2026-10-26 改版:四个 tab → 单列表 + 状态筛选;
 * 每行一条细进度条(4 段)表示 AI 审核中 → AI 通过 → 人工审核 → 已通过。
 * 原题详情 / AI 审核意见默认折叠,点开才看 —— 避免默认展开一大片干扰判断。
 */

const FILTERS: Array<{ value: ReviewQueueFilter; label: string }> = [
    { value: 'all', label: '全部' },
    { value: 'reviewing', label: 'AI 审核中' },
    { value: 'pending', label: '待人工审核' },
    { value: 'rejected', label: '未通过' },
    { value: 'approved', label: '已通过' },
]

/** 四步:AI 审核中 → AI 审核通过 → 待人工审核 → 已通过 */
const STEP_LABELS = ['AI 审核中', 'AI 审核通过', '待人工审核', '已通过'] as const

const DIM_LABELS: Record<string, string> = {
    correctness: '正确性',
    completeness: '完整性',
    clarity: '清晰度',
    originality: '原创性',
    relevance: '相关性',
}

const STATUS_LABEL: Record<string, string> = {
    draft: '待送审',
    pending_review: 'AI 审核中',
    human_pending: '待人工审核',
    rejected: '未通过',
    approved: '已通过',
}

type StepState = 'done' | 'active' | 'failed' | 'todo'

/**
 * 状态 → 四步进度。
 * 人工驳回(已通过的题被人工打回)时,失败在「待人工审核」这一步,
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
            return ['todo', 'todo', 'todo', 'todo']
    }
}

function statusLabel(item: ReviewQueueItem): string {
    if (item.status === 'rejected' && item.latestLog?.source === 'human') return '人工驳回'
    return STATUS_LABEL[item.status] ?? item.status
}

/** 细进度条:4 段,颜色克制 —— 完成/进行中统一用主色,失败才用红色 */
function StepBar({ item }: { item: ReviewQueueItem }) {
    const states = stepStates(item)
    return (
        <span
            className="flex items-center gap-2"
            title={STEP_LABELS.map((l, i) => `${l}: ${states[i]}`).join('\n')}
        >
            <span className="flex w-24 gap-1">
                {states.map((state, i) => (
                    <span
                        key={i}
                        className={cn(
                            'h-1 flex-1 rounded-full',
                            state === 'done' && 'bg-primary',
                            state === 'active' && 'bg-primary/50 animate-pulse',
                            state === 'failed' && 'bg-destructive',
                            state === 'todo' && 'bg-muted',
                        )}
                    />
                ))}
            </span>
            <span className="text-xs text-muted-foreground">{statusLabel(item)}</span>
        </span>
    )
}

/** 给预览用的纯文本:去掉代码围栏标记、压掉多余空白 */
function plainPreview(text: string): string {
    return text
        .replace(/```[a-zA-Z]*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

/** 原题详情:题干 + 参考答案 + 标签 */
function QuestionPanel({ item }: { item: ReviewQueueItem }) {
    return (
        <div className="mt-3 max-h-80 space-y-4 overflow-y-auto border-t pt-3 text-sm">
            <div>
                <p className="text-xs font-medium text-muted-foreground">题干</p>
                <pre className="mt-1 whitespace-pre-wrap break-words font-sans leading-relaxed">
                    {item.content}
                </pre>
            </div>
            <div>
                <p className="text-xs font-medium text-muted-foreground">参考答案</p>
                <pre className="mt-1 whitespace-pre-wrap break-words font-sans leading-relaxed">
                    {item.answer}
                </pre>
            </div>
            {item.tags?.length ? (
                <div className="flex flex-wrap gap-1.5">
                    {item.tags.map((t) => (
                        <span
                            key={t}
                            className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground"
                        >
                            {t}
                        </span>
                    ))}
                </div>
            ) : null}
        </div>
    )
}

/** AI 审核意见:评分 + 建议 + 改进版(标题/内容/答案都明确分区) */
function ReportPanel({ item }: { item: ReviewQueueItem }) {
    const r = item.reviewResult
    if (!r) return null

    if (r.error) {
        return (
            <div className="mt-3 flex items-center gap-2 border-t pt-3 text-sm text-destructive">
                <CircleAlert className="h-4 w-4 flex-none" />
                AI 审核失败:{r.error}
            </div>
        )
    }

    const dims = Object.entries(r.dimensions ?? {}) as Array<[string, number]>

    return (
        <div className="mt-3 space-y-3 border-t pt-3 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    AI 评分
                    <span className="font-mono text-sm font-semibold text-foreground">
                        {item.reviewScore}
                    </span>
                </span>
                <span className="text-border">|</span>
                <span>
                    {dims.map(([key, val], i) => (
                        <span key={key}>
                            {i > 0 ? ' · ' : ''}
                            {DIM_LABELS[key] ?? key} {val}
                        </span>
                    ))}
                </span>
            </div>

            {r.suggestions?.length ? (
                <div>
                    <p className="text-xs font-medium text-muted-foreground">修改建议</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-[13px]">
                        {r.suggestions.map((s, i) => (
                            <li key={i}>{s}</li>
                        ))}
                    </ul>
                </div>
            ) : null}

            {r.oneLiner || r.mnemonic ? (
                <div className="space-y-1 text-[13px] text-muted-foreground">
                    {r.oneLiner ? <p>一句话答案:{r.oneLiner}</p> : null}
                    {r.mnemonic ? <p>记忆口诀:{r.mnemonic}</p> : null}
                </div>
            ) : null}

            {r.revised ? (
                <div className="rounded-md border bg-muted/30 p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                        AI 建议的改进版(点「一键应用」可替换原题并重审)
                    </p>
                    {r.revised.title ? (
                        <p className="mb-1 text-[13px] font-semibold">{r.revised.title}</p>
                    ) : null}
                    <div className="max-h-56 space-y-3 overflow-y-auto pr-1">
                        <div>
                            <p className="text-xs text-muted-foreground">题干</p>
                            <pre className="mt-0.5 whitespace-pre-wrap break-words font-sans text-[13px]">
                                {r.revised.content}
                            </pre>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">答案</p>
                            <pre className="mt-0.5 whitespace-pre-wrap break-words font-sans text-[13px]">
                                {r.revised.answer}
                            </pre>
                        </div>
                    </div>
                    {r.revised.tags?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {r.revised.tags.map((t) => (
                                <span
                                    key={t}
                                    className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground"
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
    // 默认全部折叠:先看清题目和状态,再按需展开
    const [openPanel, setOpenPanel] = useState<'question' | 'report' | null>(null)
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

    const applyRevised = useMutation({
        mutationFn: () => reviewApi.applyRevision(item.id),
        onSuccess: (res) => {
            setTip(
                res.queued
                    ? '已应用 AI 改进版,正在重审…'
                    : '改进版已写回,审核 agent 正忙,稍后请手动重试',
            )
            invalidate()
        },
        onError: (err) => setTip(err instanceof Error ? err.message : '应用失败'),
    })

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
    const hasReport = Boolean(item.reviewResult && !item.reviewResult.error)
    const hasRevised = Boolean(
        item.reviewResult?.revised?.content && item.reviewResult.revised.answer,
    )
    const canRetry = ['draft', 'pending_review', 'rejected'].includes(item.status)

    const toggle = (panel: 'question' | 'report') =>
        setOpenPanel((cur) => (cur === panel ? null : panel))

    return (
        <div className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-semibold">{item.title}</h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {plainPreview(item.content)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                        <StepBar item={item} />
                        {item.reviewScore !== null ? (
                            <>
                                <span className="font-mono">AI {item.reviewScore} 分</span>
                                <span>·</span>
                            </>
                        ) : null}
                        <span>
                            {item.latestLog
                                ? new Date(item.latestLog.createdAt).toLocaleString('zh-CN')
                                : '-'}
                        </span>
                        {item.latestLog?.note ? (
                            <span className="truncate">· 备注:{item.latestLog.note}</span>
                        ) : null}
                    </div>
                </div>
                <div className="flex flex-none flex-wrap items-center justify-end gap-2">
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
                                variant="outline"
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
                                    一键应用 AI 改进版
                                </Button>
                            ) : null}
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                onClick={() => human.mutate({ decision: 'approve' })}
                            >
                                强行通过
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

            {/* 展开入口:原题 / AI 意见,默认都不展开 */}
            <div className="mt-3 flex items-center gap-1 border-t pt-2">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                    onClick={() => toggle('question')}
                >
                    <FileText className="h-3.5 w-3.5" />
                    原题详情
                    <ChevronDown
                        className={cn(
                            'h-3.5 w-3.5 transition-transform',
                            openPanel === 'question' && 'rotate-180',
                        )}
                    />
                </Button>
                {hasReport ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                        onClick={() => toggle('report')}
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                        AI 审核意见
                        <ChevronDown
                            className={cn(
                                'h-3.5 w-3.5 transition-transform',
                                openPanel === 'report' && 'rotate-180',
                            )}
                        />
                    </Button>
                ) : null}
            </div>

            {openPanel === 'question' ? <QuestionPanel item={item} /> : null}
            {openPanel === 'report' ? <ReportPanel item={item} /> : null}

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
    const fetching = useIsFetching({ queryKey: ['review-queue'] }) > 0

    const { data, isLoading } = useQuery({
        queryKey: ['review-queue', filter, page],
        queryFn: () => reviewApi.queue(filter, page),
        staleTime: 0,
        refetchOnMount: 'always',
        // 列表里还有「AI 审核中」的题时自动刷新
        refetchInterval: (query) =>
            query.state.data?.data.some((i) => i.status === 'pending_review') ? 4000 : false,
    })

    if (role !== 'admin') {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="text-lg">需要管理员权限</p>
                    <p className="mt-1 text-sm text-muted-foreground">审核中心仅对 admin 开放。</p>
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
                            新题先进这里,通过后才出现在题库。
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
                            <RefreshCw className={cn('h-4 w-4', fetching && 'animate-spin')} />
                            刷新
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
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
