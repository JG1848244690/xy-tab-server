import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { eachDayOfInterval, endOfWeek, format, startOfWeek } from 'date-fns'
import { ArrowUpRight, CalendarDays, Check, Clock3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { todosApi } from '@/services/todos-api'

const shades = [
  'bg-muted',
  'bg-emerald-200 dark:bg-emerald-950',
  'bg-emerald-400 dark:bg-emerald-800',
  'bg-emerald-600 dark:bg-emerald-600',
  'bg-emerald-800 dark:bg-emerald-400',
]
const labels = ['0 项', '1 项', '2 项', '3 项', '4 项及以上']
const directions: Record<string, number> = {
  ArrowUp: -1,
  ArrowDown: 1,
  ArrowLeft: -7,
  ArrowRight: 7,
}

export function TodoActivity() {
  const today = new Date()
  const todayKey = format(today, 'yyyy-MM-dd')
  const currentYear = today.getFullYear()
  const [year, setYear] = useState(currentYear)
  const [selected, setSelected] = useState(todayKey)
  const scroll = useRef<HTMLDivElement>(null)
  const activity = useQuery({
    queryKey: ['todos', 'activity', year],
    queryFn: () => todosApi.getActivity(year),
  })
  const detail = useQuery({
    queryKey: ['todos', selected],
    queryFn: () => todosApi.getTodosByDate(selected),
  })
  const counts = new Map(activity.data?.map(({ date, count }) => [date, count]))
  const plans = detail.data?.filter((todo) => todo.startDate === selected) ?? []
  const days = eachDayOfInterval({
    start: startOfWeek(new Date(year, 0, 1), { weekStartsOn: 1 }),
    end: endOfWeek(new Date(year, 11, 31), { weekStartsOn: 1 }),
  })
  const columns = { gridTemplateColumns: `repeat(${days.length / 7}, minmax(0, 1fr))` }

  useEffect(() => {
    const area = scroll.current
    if (area) area.scrollLeft = year === currentYear ? area.scrollWidth : 0
  }, [year, currentYear])

  return (
    <section aria-labelledby="todo-activity-title" className="min-w-0 rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <div>
          <h2 id="todo-activity-title" className="flex items-center gap-2 text-base font-semibold">
            <CalendarDays aria-hidden="true" className="size-4 text-emerald-700 dark:text-emerald-400" />
            计划热力图
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {activity.data ? `${year} 年安排了 ${activity.data.reduce((total, day) => total + day.count, 0)} 项计划` : '按计划开始日期统计'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            aria-label="查看年份"
            value={year}
            onChange={(event) => {
              const nextYear = Number(event.target.value)
              setYear(nextYear)
              setSelected(nextYear === currentYear ? todayKey : `${nextYear}-01-01`)
            }}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs font-medium focus-visible:outline-ring"
          >
            {Array.from({ length: 6 }, (_, index) => currentYear - index).map((option) => (
              <option value={option} key={option}>{option} 年</option>
            ))}
          </select>
          <Link to="/todos" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            打开日历 <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </Link>
        </div>
      </div>

      <div ref={scroll} className="overflow-x-auto px-4 py-4 sm:px-5">
        <div className="mx-auto grid min-w-[705px] max-w-[1080px] grid-cols-[30px_1fr] gap-x-2">
          <div className="col-start-2 mb-2 grid gap-[3px] text-[10px] whitespace-nowrap text-muted-foreground" style={columns} aria-hidden="true">
            {days.map((date, index) => date.getFullYear() === year && date.getDate() === 1 && (
              <span key={date.getMonth()} style={{ gridColumn: Math.floor(index / 7) + 1 }}>{date.getMonth() + 1}月</span>
            ))}
          </div>
          <div aria-hidden="true" className="grid grid-rows-7 items-center text-[10px] text-muted-foreground">
            <span className="row-start-1">周一</span>
            <span className="row-start-3">周三</span>
            <span className="row-start-5">周五</span>
            <span className="row-start-7">周日</span>
          </div>
          <div aria-label={`${year} 年每天的计划数量`} aria-busy={activity.isPending} role="group" className="grid grid-flow-col grid-rows-7 gap-[3px]" style={columns}>
            {days.map((date, index) => {
              const key = format(date, 'yyyy-MM-dd')
              if (date.getFullYear() !== year) return <span key={key} aria-hidden="true" className="aspect-square" />
              const count = counts.get(key) ?? 0
              const label = `${key} · ${activity.data ? `${count} 项计划` : '查看计划'}`
              return (
                <button
                  type="button"
                  key={key}
                  data-day-index={index}
                  data-count={activity.data ? count : undefined}
                  title={label}
                  aria-label={label}
                  aria-pressed={key === selected}
                  aria-current={key === todayKey ? 'date' : undefined}
                  tabIndex={key === selected ? 0 : -1}
                  onClick={() => setSelected(key)}
                  onKeyDown={(event) => {
                    const offset = directions[event.key]
                    if (offset === undefined) return
                    event.preventDefault()
                    const next = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(
                      `[data-day-index="${index + offset}"]`,
                    )
                    next?.click()
                    next?.focus()
                  }}
                  className={`aspect-square rounded-[3px] border border-foreground/5 hover:border-foreground/60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ${shades[Math.min(count, 4)]} ${key === selected ? 'ring-1 ring-inset ring-foreground/80' : ''}`}
                />
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-4 text-[11px] text-muted-foreground sm:px-5">
        {activity.isError ? (
          <button type="button" onClick={() => void activity.refetch()} className="underline underline-offset-2">计划统计加载失败，重试</button>
        ) : <span>{activity.isPending ? '正在加载计划统计…' : '跨天计划只计入开始日'}</span>}
        <div aria-label="计划数量由少到多" className="flex items-center gap-1.5">
          <span>少</span>
          {shades.map((shade, index) => <span key={shade} title={labels[index]} className={`size-2.5 rounded-[2px] border border-foreground/5 ${shade}`} />)}
          <span>多</span>
        </div>
      </div>

      <div aria-live="polite" className="grid gap-3 border-t border-border px-4 py-4 sm:grid-cols-[140px_minmax(0,1fr)] sm:px-5">
        <div>
          <p className="text-xs text-muted-foreground">{selected === todayKey ? '今天' : '所选日期'}</p>
          <h3 className="mt-1 text-sm font-semibold tabular-nums">{selected.replaceAll('-', '.')}</h3>
        </div>
        <div className="min-w-0">
          {detail.isError ? (
            <button type="button" onClick={() => void detail.refetch()} className="text-sm underline underline-offset-2">当天计划加载失败，重试</button>
          ) : detail.isPending ? (
            <p className="text-sm text-muted-foreground">正在加载当天计划…</p>
          ) : plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">当天没有开始的计划。</p>
          ) : (
            <ul className="max-h-40 space-y-2 overflow-y-auto">
              {plans.map((plan) => (
                <li key={plan.id} className="flex items-center gap-2 text-sm">
                  {plan.completed ? <Check aria-hidden="true" className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400" /> : <Clock3 aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1 break-words">{plan.content}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{plan.allDay ? '全天' : plan.startTime?.slice(0, 5)}</span>
                  <span className="sr-only">{plan.completed ? '已完成' : '未完成'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
