import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { statsApi } from '@/services/stats-api'
import { useAuthStore } from '@/store/auth-store'

const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export function LearningOverview() {
  const [page, setPage] = useState(1)
  const userId = useAuthStore((state) => state.user?.id)
  const queryClient = useQueryClient()
  const learning = useQuery({
    queryKey: ['learning', userId, page],
    queryFn: () => statsApi.getLearning(page),
    enabled: Boolean(userId),
    placeholderData: (data, previous) => previous?.queryKey[1] === userId ? data : undefined,
    refetchInterval: 60_000,
  })
  const preference = useMutation({
    mutationFn: statsApi.setLearningLeaderboard,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['learning'] }),
  })

  if (learning.isError) {
    return (
      <section className="rounded-xl border border-border bg-card px-5 py-4" aria-label="学习打卡与周榜">
        <p className="text-sm">学习打卡与周榜加载失败。<Button variant="link" onClick={() => void learning.refetch()}>重试</Button></p>
      </section>
    )
  }

  if (learning.isPending) {
    return <Skeleton className="h-64 rounded-xl" role="status" aria-label="正在加载学习打卡与周榜" />
  }

  const { today, week, streak, myRank, leaderboard, enabled, canJoin, hasMore } = learning.data
  const checkedIn = week.some((day) => day.date === today && day.completed)
  const days = week.filter((day) => day.completed).length
  const shortDate = (date: string) => date.slice(5).replace('-', '.')

  return (
    <div className="grid min-w-0 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <section aria-labelledby="learning-check-in" className="min-w-0 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h2 id="learning-check-in" className="text-base font-semibold">学习打卡</h2>
          <span className={cn('inline-flex items-center gap-1 text-xs', checkedIn ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>
            {checkedIn && <Check aria-hidden="true" className="size-3.5" />}
            {checkedIn ? '今日已打卡' : '今日待练习'}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <p className="text-sm text-muted-foreground">连续 <strong className="font-serif text-2xl font-normal text-foreground tabular-nums">{streak}</strong> 天</p>
          <p className="text-xs text-muted-foreground">本周练习 <strong className="font-medium text-foreground tabular-nums">{days}/7</strong> 天</p>
        </div>
        <ul aria-label="本周每日学习记录" className="mt-3 grid grid-cols-7 gap-1.5 sm:gap-2">
          {week.map((day, index) => (
            <li key={day.date} aria-current={today === day.date ? 'date' : undefined} className="min-w-0 text-center">
              <span className="text-[11px] text-muted-foreground">{weekdays[index]}</span>
              <div className={cn(
                'mt-1 flex h-8 items-center justify-center rounded-md border',
                day.completed ? 'border-emerald-700/20 bg-emerald-700/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400' : 'border-border bg-background/80 text-muted-foreground',
                day.date === today && 'border-foreground/50',
              )}>
                {day.completed ? <Check aria-hidden="true" className="size-4" /> : <span aria-hidden="true" className="size-1 rounded-full bg-current opacity-40" />}
                <span className="sr-only">{day.completed ? '已打卡' : day.date > today ? '未到' : '未打卡'}</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
          <p className="text-muted-foreground">{checkedIn ? '下次练习从明天开始计入打卡。' : '完成一道共享题库题目后自动打卡。'}</p>
          {!checkedIn && <Link to="/test-center" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">去练一题 <ArrowUpRight aria-hidden="true" className="size-3.5" /></Link>}
        </div>
      </section>

      <section aria-labelledby="learning-leaderboard" aria-busy={learning.isPlaceholderData} className="min-w-0 border-t border-border px-4 py-4 lg:border-t-0 lg:border-l sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div>
            <h2 id="learning-leaderboard" className="text-base font-semibold">学习周榜</h2>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">{shortDate(week[0].date)}–{shortDate(week[6].date)} · 按练习天数排名</p>
          </div>
          {canJoin && (
            <Button size="sm" variant={enabled ? 'ghost' : 'outline'} disabled={preference.isPending || learning.isPlaceholderData} onClick={() => preference.mutate(!enabled)}>
              {enabled ? '退出周榜' : '匿名加入'}
            </Button>
          )}
        </div>
        {preference.isError && <p role="alert" className="mt-2 text-xs text-destructive">参与状态更新失败，请重试。</p>}
        {leaderboard.length > 0 ? (
          <div className="mt-3 max-h-48 overflow-y-auto border-y border-border">
            <table className="w-full text-left text-sm">
              <thead className="sr-only"><tr><th>名次</th><th>同学</th><th>练习天数</th></tr></thead>
              <tbody className="divide-y divide-border">
                {leaderboard.map((row) => (
                  <tr key={row.alias} className={row.isMe ? 'bg-muted/50' : undefined}>
                    <td className="w-12 py-1.5 pl-2 font-medium tabular-nums">{row.rank}</td>
                    <td className="py-1.5"><span className="break-all">{row.alias}</span>{row.isMe && <span className="ml-2 text-xs text-muted-foreground">（你）</span>}</td>
                    <td className="w-14 py-1.5 pr-2 text-right tabular-nums">{row.days} 天</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 border-y border-border py-3 text-sm text-muted-foreground">{page === 1 ? '本周还没有同学上榜。' : '这一页暂无上榜同学。'}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {myRank ? `你的名次 · 第 ${myRank.rank} 名 · ${myRank.days} 天` : enabled ? '完成本周第一题后上榜。' : canJoin ? '自愿参与，榜上只显示匿名昵称。' : '验证邮箱后可以加入周榜。'}
          </p>
          {(page > 1 || hasMore) && (
            <div className="flex items-center gap-1" aria-label="周榜分页">
              <Button variant="ghost" size="icon-sm" aria-label="上一页" disabled={page === 1 || learning.isPlaceholderData} onClick={() => setPage(page - 1)}><ChevronLeft /></Button>
              <span className="text-xs tabular-nums">{page}</span>
              <Button variant="ghost" size="icon-sm" aria-label="下一页" disabled={!hasMore || learning.isPlaceholderData} onClick={() => setPage(page + 1)}><ChevronRight /></Button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
