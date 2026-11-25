import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { questionsApi } from '@/services/questions-api'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { MobileGate } from '@/components/mobile-gate'
import { PracticeCompletionFeedback } from '@/components/practice-completion-feedback'
import { useCompletePractice } from '@/hooks/use-complete-practice'
import {
  QuestionPanel,
  MarkdownEditor,
  CodeEditor,
  HistoryDialog,
  PracticeHeader,
} from './components'
import type { Question, Attempt } from './types'

export default function PracticePage() {
  const params = useParams()
  const questionId = params.id as string
  const { resolvedTheme } = useTheme()
  const editorTheme = (resolvedTheme === 'dark' ? 'dark' : 'light') as 'dark' | 'light'
  const monacoTheme = (resolvedTheme === 'dark' ? 'paper-dark' : 'paper-light') as
    | 'paper-dark'
    | 'paper-light'

  // 状态管理
  const [userAnswer, setUserAnswer] = useState('')
  const [timeSpent, setTimeSpent] = useState(0)
  const [startTime, setStartTime] = useState(Date.now())
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const submit = useCompletePractice(questionId)
  const isSubmitted = submit.isSuccess

  // 获取题目详情
  const { data: question, isLoading: isLoadingQuestion } = useQuery<Question>({
    queryKey: ['question', questionId],
    queryFn: () => questionsApi.getOne(questionId),
    enabled: !!questionId,
  })

  // 获取答题历史
  const { data: attempts = [] } = useQuery<Attempt[]>({
    queryKey: ['question-attempts', questionId],
    queryFn: () => questionsApi.getAttempts(questionId),
    enabled: !!questionId,
  })

  // 计算答题时间
  useEffect(() => {
    if (isSubmitted) return // 提交后停止计时
    const interval = setInterval(() => {
      setTimeSpent(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime, isSubmitted])

  const handleSubmit = () => {
    if (userAnswer.trim()) submit.mutate({ userAnswer: userAnswer.trim(), timeSpent })
  }

  // 重新开始答题
  const handleRestart = () => {
    setUserAnswer('')
    setTimeSpent(0)
    setStartTime(Date.now())
    submit.reset()
  }

  // 回顾历史记录
  const handleReviewHistory = (attempt: Attempt) => {
    handleRestart()
    setUserAnswer(attempt.userAnswer || '')
    setHistoryDialogOpen(false)
  }

  // 加载状态
  if (isLoadingQuestion) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Skeleton className="h-8 w-8" />
      </div>
    )
  }

  // 题目不存在
  if (!question) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg mb-4">题目不存在</p>
          <Button onClick={() => window.history.back()}>返回</Button>
        </div>
      </div>
    )
  }

  return (
    <MobileGate>
      <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden">
        {/* 顶部:题目标题 / 难度 / 计时 */}
        <PracticeHeader question={question} timeSpent={timeSpent} />
        {isSubmitted && <PracticeCompletionFeedback checkIn={submit.data?.checkIn} />}
        {submit.isError && <p role="alert" className="text-sm text-destructive">提交失败，请重试。答案仍可编辑。</p>}

        {/* 左右分栏放在同一张纸面卡片里,避免白底预览器直接贴在页面背景上 */}
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-card">
          <ResizablePanelGroup orientation="horizontal" className="h-full min-w-0 max-w-full">
            {/* 左侧:题目面板(题目内容 + 参考答案 Tab 切换) */}
            <ResizablePanel defaultSize={50}>
              <QuestionPanel
                question={question}
                questionId={questionId}
                onOpenHistory={() => setHistoryDialogOpen(true)}
              />
            </ResizablePanel>

            <ResizableHandle withHandle className="w-px h-full bg-border" />

            {/* 右侧:答题区域 - 根据题目类型条件渲染 */}
            <ResizablePanel defaultSize={50}>
              {question.type === 'text' ? (
                // 理论题:使用 Markdown 编辑器
                <MarkdownEditor
                  userAnswer={userAnswer}
                  onAnswerChange={setUserAnswer}
                  isSubmitted={isSubmitted}
                  isSubmitting={submit.isPending}
                  onSubmit={handleSubmit}
                  onRestart={handleRestart}
                />
              ) : (
                // 代码题:使用代码编辑器
                <CodeEditor
                  userAnswer={userAnswer}
                  onAnswerChange={setUserAnswer}
                  monacoTheme={monacoTheme}
                  isSubmitted={isSubmitted}
                  isSubmitting={submit.isPending}
                  onSubmit={handleSubmit}
                  onRestart={handleRestart}
                />
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* 答题历史 Dialog */}
        <HistoryDialog
          open={historyDialogOpen}
          onOpenChange={setHistoryDialogOpen}
          attempts={attempts}
          onReviewHistory={handleReviewHistory}
        />
      </div>
    </MobileGate>
  )
}
