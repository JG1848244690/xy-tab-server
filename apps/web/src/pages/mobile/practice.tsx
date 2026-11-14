import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, ChevronDown, ChevronUp, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/markdown'
import { questionsApi, type Question } from '@/services/questions-api'
import { cn } from '@/lib/utils'

const DIFFICULTY_TEXT: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

export default function MobilePractice() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: question, isPending } = useQuery<Question>({
    queryKey: ['question', id],
    queryFn: () => questionsApi.getOne(id),
    enabled: !!id,
  })

  const [answer, setAnswer] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [result, setResult] = useState<null | boolean>(null)

  /** 存量导入的题里 content 只是标题,直接展开参考答案 */
  const contentIsStub = useMemo(
    () => (question?.content ?? '').trim().length < 20,
    [question?.content],
  )

  useEffect(() => {
    if (!question) return
    setShowAnswer(contentIsStub && Boolean(question.answer))
  }, [question, contentIsStub])

  useEffect(() => {
    if (result !== null) return
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(t)
  }, [result])

  const submit = useMutation({
    mutationFn: async (isCorrect: boolean) => {
      const res = await questionsApi.submitAnswer(id, {
        userAnswer: answer.trim(),
        timeSpent: seconds,
      })
      await questionsApi.markCorrect(id, res.attempt.id, isCorrect)
      return isCorrect
    },
    onSuccess: (isCorrect) => {
      setResult(isCorrect)
      setShowAnswer(true)
      queryClient.invalidateQueries({ queryKey: ['question', id] })
      queryClient.invalidateQueries({ queryKey: ['m-questions'] })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
  })

  const restart = () => {
    setAnswer('')
    setSeconds(0)
    setResult(null)
    setShowAnswer(false)
  }

  if (isPending) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!question) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-[14px] text-muted-foreground">题目不存在或没有权限</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/m/questions')}>
          返回题库
        </Button>
      </div>
    )
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  return (
    <div className="mx-auto w-full max-w-xl pb-8">
      {/* 顶部:返回 + 计时 */}
      <div className="sticky top-12 z-10 flex items-center justify-between border-b border-border bg-background/92 px-4 py-2 backdrop-blur-md">
        <Link
          to="/m/questions"
          className="flex items-center gap-1 text-[13px] text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          题库
        </Link>
        <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
          {mm}:{ss}
        </span>
      </div>

      <div className="px-4 pt-4">
        <h1 className="font-serif text-[18px] leading-snug tracking-tight">{question.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>{DIFFICULTY_TEXT[question.difficulty] ?? question.difficulty}</span>
          {question.techStack ? <span>{question.techStack}</span> : null}
          <span>{question.type === 'markdown' ? '代码题' : '理论题'}</span>
        </div>
      </div>

      {/* 题目内容 */}
      <section className="mt-4 px-4">
        {question.content?.trim() ? (
          <Markdown className="text-[14px]">{question.content}</Markdown>
        ) : null}
      </section>

      {/* 作答 */}
      <section className="mt-5 px-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[12px] font-medium tracking-wide text-muted-foreground">我的作答</h2>
        </div>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={result !== null || submit.isPending}
          placeholder={question.type === 'markdown' ? '写下思路或代码' : '写下你的答案'}
          rows={question.type === 'markdown' ? 10 : 6}
          className={cn(
            'w-full resize-y rounded-lg border border-border bg-card px-3 py-2.5 text-[13.5px] leading-relaxed',
            'placeholder:text-muted-foreground/70 focus:border-primary/50 focus:outline-none',
            question.type === 'markdown' && 'font-mono text-[12.5px]',
            (result !== null || submit.isPending) && 'opacity-70',
          )}
        />

        {result === null ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-11"
              disabled={!answer.trim() || submit.isPending}
              onClick={() => submit.mutate(false)}
            >
              {submit.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : (
                <X className="mr-1.5 h-4 w-4" />
              )}
              没答上来
            </Button>
            <Button
              className="h-11"
              disabled={!answer.trim() || submit.isPending}
              onClick={() => submit.mutate(true)}
            >
              <Check className="mr-1.5 h-4 w-4" />
              答对了
            </Button>
          </div>
        ) : (
          <div
            className={cn(
              'mt-3 rounded-lg border px-3 py-2.5 text-[12.5px]',
              result
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
            )}
          >
            {result ? '已记为完成 · 继续保持' : '已记录 · 看一遍参考答案再试一次'}
          </div>
        )}
      </section>

      {/* 参考答案 */}
      <section className="mt-4 px-4">
        <button
          type="button"
          onClick={() => setShowAnswer((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3.5 py-2.5 text-[13px]"
        >
          <span>参考答案</span>
          {showAnswer ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {showAnswer ? (
          <div className="mt-2 rounded-lg border border-border bg-card px-3.5 py-3">
            {question.answer?.trim() ? (
              <Markdown className="text-[13.5px]">{question.answer}</Markdown>
            ) : (
              <p className="text-[12.5px] text-muted-foreground">暂无参考答案</p>
            )}
          </div>
        ) : null}
      </section>

      {result !== null ? (
        <div className="mt-5 grid grid-cols-2 gap-2 px-4">
          <Button variant="outline" className="h-11" onClick={restart}>
            再做一次
          </Button>
          <Button className="h-11" onClick={() => navigate('/m/questions')}>
            下一题
          </Button>
        </div>
      ) : null}
    </div>
  )
}
