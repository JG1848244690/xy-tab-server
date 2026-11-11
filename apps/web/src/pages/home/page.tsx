import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, FileQuestion, Loader2 } from 'lucide-react'
import { statsApi } from '@/services/stats-api'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

const DIFFICULTY: Record<string, { label: string; className: string }> = {
  easy: { label: '简单', className: 'text-emerald-700 dark:text-emerald-400' },
  medium: { label: '中等', className: 'text-amber-700 dark:text-amber-400' },
  hard: { label: '困难', className: 'text-red-700 dark:text-red-400' },
}

export default function HomePage() {
  const navigate = useNavigate()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => statsApi.getDashboardStats(),
  })

  const formatTime = (dateString: string) =>
    formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: zhCN })

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!stats) return null

  const { questions, todos } = stats
  const metrics = [
    {
      label: '累计练习',
      value: questions.totalAttempts,
      hint: `正确 ${questions.totalCorrect} 题`,
    },
    {
      label: '正确率',
      value: `${questions.accuracy}%`,
      hint: `本周新增 ${questions.thisWeekAdded} 题`,
    },
    {
      label: '今日打卡',
      value: `${todos.todayCompleted}/${todos.todayTotal}`,
      hint: '当天待办完成情况',
    },
    {
      label: '本周完成率',
      value: `${todos.completionRate}%`,
      hint: `本周答题 ${questions.thisWeekAttempted} 次`,
    },
  ]

  return (
    <div className="flex flex-col gap-9">
      {/* 页头 */}
      <header className="border-b border-foreground/70 pb-5">
        <p className="font-mono text-[10.5px] tracking-[0.18em] text-muted-foreground">
          DASHBOARD · {new Date().toISOString().slice(0, 7).replace('-', '.')}
        </p>
        <h1 className="mt-2 font-serif text-[28px] leading-tight tracking-tight">概览</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          今天的进度、最近的题目,和你正在维护的内容。
        </p>
      </header>

      {/* 指标条 */}
      <dl className="grid grid-cols-2 gap-y-6 border-b border-border pb-6 sm:grid-cols-4">
        {metrics.map((m, i) => (
          <div
            key={m.label}
            className={i === 0 ? 'sm:pr-6' : 'sm:border-l sm:border-border sm:px-6'}
          >
            <dt className="font-mono text-[10.5px] tracking-[0.12em] text-muted-foreground">
              {m.label}
            </dt>
            <dd className="mt-1.5 font-serif text-[30px] leading-none tabular-nums">{m.value}</dd>
            <dd className="mt-1.5 text-[11.5px] text-muted-foreground">{m.hint}</dd>
          </div>
        ))}
      </dl>

      {/* 最近添加 */}
      <section>
        <div className="mb-1 flex items-baseline justify-between border-b border-foreground/70 pb-2">
          <h2 className="text-[15px] font-medium tracking-[0.02em]">最近添加的题目</h2>
          <button
            onClick={() => navigate('/test-center')}
            className="text-[12px] text-muted-foreground transition-colors hover:text-primary"
          >
            去题库 →
          </button>
        </div>

        {questions.recentAdded.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">暂无最近添加的题目</p>
        ) : (
          <ol>
            {questions.recentAdded.map((question, i) => {
              const d = DIFFICULTY[question.difficulty] ?? {
                label: question.difficulty,
                className: 'text-muted-foreground',
              }
              return (
                <li key={question.id}>
                  <button
                    onClick={() => navigate(`/test-center/practice/${question.id}`)}
                    className="group flex w-full items-baseline gap-4 border-b border-border py-3 text-left transition-colors hover:bg-card/70"
                  >
                    <span className="w-6 flex-none font-mono text-[11px] text-muted-foreground">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-serif text-[15px] leading-snug transition-colors group-hover:text-primary">
                      {question.title}
                    </span>
                    <span className={`flex-none font-mono text-[10.5px] ${d.className}`}>
                      {d.label}
                    </span>
                    <span className="hidden w-28 flex-none text-right font-mono text-[10.5px] text-muted-foreground sm:block">
                      {formatTime(question.createdAt)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      {/* 最近练习 */}
      {questions.recentAttempted.length > 0 ? (
        <section>
          <div className="mb-1 flex items-baseline justify-between border-b border-foreground/70 pb-2">
            <h2 className="text-[15px] font-medium tracking-[0.02em]">最近做的题目</h2>
            <span className="font-mono text-[10.5px] text-muted-foreground">
              {questions.recentAttempted.length} 条
            </span>
          </div>

          <ol>
            {questions.recentAttempted.map((attempt, i) => (
              <li key={attempt.id}>
                <button
                  onClick={() => navigate(`/test-center/practice/${attempt.questionId}`)}
                  className="group flex w-full items-baseline gap-4 border-b border-border py-3 text-left transition-colors hover:bg-card/70"
                >
                  <span className="w-6 flex-none font-mono text-[11px] text-muted-foreground">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="flex-none">
                    {attempt.isCorrect === 1 ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <FileQuestion className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-serif text-[15px] leading-snug transition-colors group-hover:text-primary">
                    {attempt.questionTitle}
                  </span>
                  <span
                    className={`flex-none font-mono text-[10.5px] ${
                      attempt.isCorrect === 1
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-700 dark:text-red-400'
                    }`}
                  >
                    {attempt.isCorrect === 1 ? '正确' : '错误'}
                  </span>
                  <span className="hidden w-28 flex-none text-right font-mono text-[10.5px] text-muted-foreground sm:block">
                    {formatTime(attempt.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  )
}
