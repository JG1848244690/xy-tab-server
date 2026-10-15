import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { questionsApi } from '@/services/questions-api'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
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
  const queryClient = useQueryClient()
  const { resolvedTheme } = useTheme()
  const editorTheme = (resolvedTheme === 'dark' ? 'dark' : 'light') as 'dark' | 'light'
  const monacoTheme = (resolvedTheme === 'dark' ? 'vs-dark' : 'light') as 'vs-dark' | 'light'

  // 状态管理
  const [userAnswer, setUserAnswer] = useState('')
  const [timeSpent, setTimeSpent] = useState(0)
  const [startTime, setStartTime] = useState(Date.now())
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)

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

  // 提交并标记答案
  const submitAndMarkMutation = useMutation({
    mutationFn: async ({ isCorrect }: { isCorrect: boolean }) => {
      // 先提交答案
      const submitResult = await questionsApi.submitAnswer(questionId, {
        userAnswer: userAnswer.trim(),
        timeSpent,
      })
      // 然后标记对错
      await questionsApi.markCorrect(questionId, submitResult.attempt.id, isCorrect)
      return submitResult
    },
    onSuccess: () => {
      setIsSubmitted(true)
      queryClient.invalidateQueries({ queryKey: ['question', questionId] })
      queryClient.invalidateQueries({ queryKey: ['question-attempts', questionId] })
      queryClient.invalidateQueries({ queryKey: ['questions'] })
    },
  })

  // 计算答题时间
  useEffect(() => {
    if (isSubmitted) return // 提交后停止计时
    const interval = setInterval(() => {
      setTimeSpent(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime, isSubmitted])

  // 提交并标记答案
  const handleSubmitAndMark = (isCorrect: boolean) => {
    if (!userAnswer.trim()) {
      alert('请输入答案')
      return
    }
    submitAndMarkMutation.mutate({ isCorrect })
  }

  // 重新开始答题
  const handleRestart = () => {
    setUserAnswer('')
    setTimeSpent(0)
    setStartTime(Date.now())
    setIsSubmitted(false)
  }

  // 回顾历史记录
  const handleReviewHistory = (attempt: Attempt) => {
    setUserAnswer(attempt.userAnswer || '')
    setIsSubmitted(false)
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
    <div className="flex flex-col overflow-hidden w-full h-full min-w-0 max-w-full">
      {/* 顶部导航栏 */}
      <PracticeHeader question={question} timeSpent={timeSpent} />

      {/* 主要内容区域 */}
      <ResizablePanelGroup orientation="horizontal" className="flex-1 min-w-0 max-w-full">
        {/* 左侧：题目面板（题目内容 + 参考答案 Tab 切换） */}
        <ResizablePanel defaultSize={50}>
          <QuestionPanel
            question={question}
            questionId={questionId}
            editorTheme={editorTheme}
            onOpenHistory={() => setHistoryDialogOpen(true)}
          />
        </ResizablePanel>

        <ResizableHandle withHandle className="w-0.5 h-full" />

        {/* 右侧：答题区域 - 根据题目类型条件渲染 */}
        <ResizablePanel defaultSize={50}>
          {question.type === 'text' ? (
            // 理论题：使用 Markdown 编辑器
            <MarkdownEditor
              userAnswer={userAnswer}
              onAnswerChange={setUserAnswer}
              editorTheme={editorTheme}
              isSubmitted={isSubmitted}
              isSubmitting={submitAndMarkMutation.isPending}
              onSubmitCorrect={() => handleSubmitAndMark(true)}
              onSubmitWrong={() => handleSubmitAndMark(false)}
              onRestart={handleRestart}
            />
          ) : (
            // 代码题：使用代码编辑器
            <CodeEditor
              userAnswer={userAnswer}
              onAnswerChange={setUserAnswer}
              monacoTheme={monacoTheme}
              isSubmitted={isSubmitted}
              isSubmitting={submitAndMarkMutation.isPending}
              onSubmitCorrect={() => handleSubmitAndMark(true)}
              onSubmitWrong={() => handleSubmitAndMark(false)}
              onRestart={handleRestart}
            />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* 答题历史 Dialog */}
      <HistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        attempts={attempts}
        onReviewHistory={handleReviewHistory}
      />
    </div>
  )
}
