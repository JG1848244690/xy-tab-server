import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { History, Clock, Check, X, RotateCcw } from 'lucide-react'
import type { Attempt } from '../types'

interface HistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  attempts: Attempt[]
  onReviewHistory: (attempt: Attempt) => void
}

export function HistoryDialog({
  open,
  onOpenChange,
  attempts,
  onReviewHistory,
}: HistoryDialogProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <History className="h-5 w-5" />
            答题历史
            {attempts.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                共 {attempts.length} 条记录
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto mt-4 space-y-4 pr-2">
          {attempts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">暂无答题历史</p>
              <p className="text-sm mt-2">开始答题后，历史记录将显示在这里</p>
            </div>
          ) : (
            attempts.map((attempt) => (
              <div
                key={attempt.id}
                className="group relative border rounded-lg bg-card hover:bg-accent/50 transition-colors overflow-hidden"
              >
                {/* 顶部信息栏 */}
                <div className="flex items-center justify-between p-4 border-b bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      #{attempt.attemptCount}
                    </div>
                    <div>
                      <div className="font-medium text-sm">第 {attempt.attemptCount} 次尝试</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(attempt.timeSpent)}
                        </span>
                        {attempt.createdAt && (
                          <>
                            <span>•</span>
                            <span>
                              {new Date(attempt.createdAt).toLocaleString('zh-CN', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {attempt.isCorrect === 1 ? (
                      <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                        <Check className="h-3 w-3 mr-1" />
                        正确
                      </Badge>
                    ) : attempt.isCorrect === 0 ? (
                      <Badge variant="destructive">
                        <X className="h-3 w-3 mr-1" />
                        错误
                      </Badge>
                    ) : (
                      <Badge variant="secondary">未标记</Badge>
                    )}
                  </div>
                </div>

                {/* 答案内容区域 */}
                <div className="p-4">
                  <div className="bg-muted/50 rounded-md p-4 border border-border/50">
                    <pre className="text-sm font-mono whitespace-pre-wrap wrap-break-word overflow-x-auto text-foreground">
                      {attempt.userAnswer || '(空)'}
                    </pre>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="px-4 pb-4 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReviewHistory(attempt)}
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    回顾此答案
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
