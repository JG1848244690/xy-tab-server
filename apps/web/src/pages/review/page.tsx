import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ShieldCheck, ChevronDown, CircleAlert, CircleCheck, Sparkles } from 'lucide-react'
import { reviewApi, type ReviewQueueItem } from '@/services/review-api'
import { useAuthStore } from '@/store/auth-store'
import { QuotaBadge } from '@/components/ai-quota-badge'
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
 * 审核工作台(仅 admin 可见,见 dashboard-nav 的显隐 + 后端 403 兜底)
 *
 * 流程(docs/review-workflow-plan.md):AI 前置审核 →
 *   - tab 待人审:AI 完成(≥60 分)的题,人工通过/驳回
 *   - tab 被AI打回:AI <60 分的题,看报告 → 改内容重提 / 强行通过
 */

/** AI 报告渲染:五维 + 建议 + 口诀 */
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
        </div>
    )
}

function QueueItemCard({ item, tab }: { item: ReviewQueueItem; tab: 'pending' | 'rejected' }) {
    const queryClient = useQueryClient()
    const [reportOpen, setReportOpen] = useState(false)
    const [rejectOpen, setRejectOpen] = useState(false)
    const [note, setNote] = useState('')

    const human = useMutation({
        mutationFn: (args: { decision: 'approve' | 'reject'; note?: string }) =>
            reviewApi.human(item.id, args.decision, args.note),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['review-queue'] })
            setRejectOpen(false)
            setNote('')
        },
    })

    return (
        <div className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-semibold">{item.title}</h3>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">
                            AI {item.reviewScore ?? '-'} 分
                        </span>
                        <span>·</span>
                        <span>
                            {item.latestLog
                                ? new Date(item.latestLog.createdAt).toLocaleString('zh-CN')
                                : '-'}
                        </span>
                        {item.latestLog?.note ? <span>· 备注:{item.latestLog.note}</span> : null}
                    </div>
                </div>
                <div className="flex flex-none items-center gap-2">
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
                    {tab === 'pending' ? (
                        <>
                            <Button
                                size="sm"
                                disabled={human.isPending}
                                onClick={() => human.mutate({ decision: 'approve' })}
                            >
                                <CircleCheck className="h-4 w-4" />
                                通过并发布
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                disabled={human.isPending}
                                onClick={() => setRejectOpen(true)}
                            >
                                <CircleAlert className="h-4 w-4" />
                                驳回
                            </Button>
                        </>
                    ) : (
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={human.isPending}
                            onClick={() => human.mutate({ decision: 'approve' })}
                        >
                            不认同,强行通过
                        </Button>
                    )}
                </div>
            </div>

            {reportOpen && (
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

function QueueList({ tab }: { tab: 'pending' | 'rejected' }) {
    const { data, isLoading } = useQuery({
        queryKey: ['review-queue', tab],
        queryFn: () => reviewApi.queue(tab),
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
                {tab === 'pending' ? '人工审核队列空空如也' : '没有被 AI 打回的题目'}
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

    // 权限边界在后端;这里只是导航显隐的兜底
    if (role !== 'admin') {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="text-lg">需要管理员权限</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        审核工作台仅对 admin 开放。
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
                        <h1 className="text-xl font-bold">审核工作台</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            AI 前置审核 → 人工裁决 → 发布。AI 的高分只是建议,通过权在人。
                        </p>
                    </div>
                    <QuotaBadge />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <Tabs defaultValue="pending">
                    <TabsList>
                        <TabsTrigger value="pending">待人审</TabsTrigger>
                        <TabsTrigger value="rejected">被 AI 打回</TabsTrigger>
                    </TabsList>
                    <TabsContent value="pending" className="mt-4">
                        <QueueList tab="pending" />
                    </TabsContent>
                    <TabsContent value="rejected" className="mt-4">
                        <QueueList tab="rejected" />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
