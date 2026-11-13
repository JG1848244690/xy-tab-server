import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import ConfirmDialog from '@/components/ConfirmDialog'
import { questionsApi, type Submission } from '@/services/questions-api'

const STATUS_LABEL: Record<Submission['status'], { text: string; tone: string }> = {
  draft: { text: '草稿', tone: 'text-muted-foreground' },
  pending_review: { text: '审核中', tone: 'text-muted-foreground' },
  human_pending: { text: '待人工审核', tone: 'text-primary' },
  rejected: { text: '已驳回', tone: 'text-destructive' },
}

/**
 * 我的投稿:普通用户提交的题进 human_pending,主列表(只显示已过审)看不到,
 * 所以单开一个页签,同时提供「撤回」——只对自己未过审的稿子有效。
 */
export function Submissions() {
  const queryClient = useQueryClient()
  const [pendingId, setPendingId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['my-submissions'],
    queryFn: questionsApi.getMySubmissions,
  })

  const withdraw = useMutation({
    mutationFn: (id: string) => questionsApi.delete(id),
    onSuccess: () => {
      setPendingId(null)
      queryClient.invalidateQueries({ queryKey: ['my-submissions'] })
      queryClient.invalidateQueries({ queryKey: ['questions'] })
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        加载中…
      </div>
    )
  }

  if (!data?.length) {
    return (
      <div className="rounded-md border border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
        还没有投稿。点右上角「添加题目」提交,审核通过后会进题库。
      </div>
    )
  }

  return (
    <>
      <ul className="divide-y divide-border rounded-md border border-border">
        {data.map((item) => {
          const status = STATUS_LABEL[item.status] ?? {
            text: item.status,
            tone: 'text-muted-foreground',
          }
          return (
            <li key={item.id} className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{item.title}</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString('zh-CN')}
                  {item.reviewScore != null ? ` · AI ${item.reviewScore}` : ''}
                </p>
              </div>

              <Badge variant="outline" className={status.tone}>
                {status.text}
              </Badge>

              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setPendingId(item.id)}
              >
                <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                撤回
              </Button>
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        open={!!pendingId}
        onOpenChange={(open) => !open && setPendingId(null)}
        title="确认撤回"
        description="撤回后这条投稿会被删除,需要重新提交。确定吗?"
        confirmText="撤回"
        cancelText="取消"
        onConfirm={() => pendingId && withdraw.mutate(pendingId)}
      />
    </>
  )
}
