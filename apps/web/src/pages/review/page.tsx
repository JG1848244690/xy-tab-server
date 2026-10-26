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
    Clock,
    Loader2,
} from 'lucide-react'
import { reviewApi, type ReviewQueueItem, type ReviewTab } from '@/services/review-api'
import { useAuthStore } from '@/store/auth-store'
import { QuotaBadge } from '@/components/ai-quota-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

/**
 * 审核中心(仅 admin 可见,见 dashboard-nav 的显隐 + 后端 403 兜底)
 *
 * 四个视角(docs/review-workflow-plan.md):
 *   待人审   = AI ≥60,等人工通过 / 驳回
 *   审核中   = AI 正在跑(自动轮询,也可手动刷新)
 *   被AI打回 = AI <60,带完整报告 + 改进版(一键应用 → 原题重审)
 *   已通过   = 已发布(公开站下次重建可见)
 */

const TAB_META: Record<ReviewTab, { label: string; empty: string }> = {
    pending: { label: '待人审', empty: '人工审核队列空空如也' },
    reviewing: { label: '审核中', empty: '当前没有正在审核的题目' },
    rejected: { label: '被 AI 打回', empty: '没有被 AI 打回的题目' },
    approved: { label: '已通过', empty: '还没有已通过的题目' },
}

/** 题目审核状态 chip(四个 tab 里都能一眼看到状态) */
function StatusChip({ status, score }: { status: string; score: number | null }) {
    const map: Record<string, { text: string; className: string }> = {
        pending_review: {
            text: '审核中',
            className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300',
        },
        human_pending: {
            text: '待人审',
            className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
        },
        rejected: {
            text: '未通过',
            className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
        },
        approved: {
            text: '已通过',
            className: 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300',
        },
        draft: {
            text: '未送审',
            className: 'border-muted bg-muted text-muted-foreground',
        },
    }
    const m = map[status] ?? { text: status, className: 'border-muted bg-muted text-muted-foreground' }
    return (
        <div className="flex items-center gap-2">
            <Badge variant="outline" className={m.className}>
                {status === 'pending_review' && <Loader2 className="h-3 w-3 animate-spin" />}
                {m.text}
            </Badge>
            {score !== null ? (
                <span className="font-mono text-xs text-muted-foreground">AI {score} 分</span>
            ) : null}
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

function QueueItemCard({ item, tab }: { item: ReviewQueueItem; tab: ReviewTab }) {
    const queryClient = useQueryClient()
    const [reportOpen, setReportOpen] = useState(tab !== 'approved')
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

    // 原题重触发(内容改过 / 想再跑一次)
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
    const hasRevised = Boolean(item.reviewResult?.revised?.content && item.reviewResult.revised.answer)

    return (
        <div className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-semibold">{item.title}</h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <StatusChip status={item.status} score={item.reviewScore} />
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
                    {tab === 'pending' ? (
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
                    {tab === 'reviewing' ? (
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
                            重新提交
                        </Button>
                    ) : null}
                    {tab === 'rejected' ? (
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
                                重新审核
                            </Button>
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
                </div>
            </div>

            {tip ? <p className="mt-2 text-xs text-primary">{tip}</p> : null}

            {reportOpen && item.reviewResult && (
                <div className="mt-3 border-t pt-3">
                    <ReportPanel item={item} />
                </div>
            )}

            {tab === 'reviewing' ? (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    AI 正在审核,完成后会自动进入「待人审」或「被 AI 打回」
                </p>
            ) : null}

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

function QueueList({ tab }: { tab: ReviewTab }) {
    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['review-queue', tab],
        queryFn: () => reviewApi.queue(tab),
        // 审核状态变化快(agent 异步写库),不能吃全局 60s 缓存
        staleTime: 0,
        refetchOnMount: 'always',
        // 审核中自动轮询,其他 tab 只在手动刷新/操作后更新(省请求)
        refetchInterval: tab === 'reviewing' ? 4000 : false,
    })

    if (isLoading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
            </div>
        )
    }

    if (!data?.data.length) {
        return (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                {TAB_META[tab].empty}
                {isFetching ? '(刷新中…)' : ''}
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {data.data.map((item) => (
                <QueueItemCard key={item.id} item={item} tab={tab} />
            ))}
        </div>
    )
}

export default function ReviewPage() {
    const role = useAuthStore((s) => s.user?.role)
    const queryClient = useQueryClient()
    const [tab, setTab] = useState<ReviewTab>('pending')
    // 任一队列请求在飞 → 刷新按钮转圈且禁用(防连点)
    const fetching = useIsFetching({ queryKey: ['review-queue'] }) > 0

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
                <Tabs value={tab} onValueChange={(v) => setTab(v as ReviewTab)}>
                    <TabsList>
                        {(Object.keys(TAB_META) as ReviewTab[]).map((key) => (
                            <TabsTrigger key={key} value={key}>
                                {TAB_META[key].label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    <TabsContent value={tab} className="mt-4">
                        <QueueList tab={tab} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
