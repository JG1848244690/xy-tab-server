import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Loader2, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { questionsApi, type Question } from '@/services/questions-api'
import { useDebounce } from 'ahooks'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 15

const STATUS_FILTERS = [
  { key: '', label: '全部' },
  { key: 'incomplete', label: '未完成' },
  { key: 'completed', label: '已完成' },
] as const

const STATUS_TONE: Record<string, string> = {
  not_started: 'text-muted-foreground',
  in_progress: 'text-primary',
  completed: 'text-emerald-600 dark:text-emerald-400',
}

const STATUS_TEXT: Record<string, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  completed: '已完成',
}

const DIFFICULTY_TEXT: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

export default function MobileQuestions() {
  const [status, setStatus] = useState<'' | 'incomplete' | 'completed'>('')
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounce(searchInput, { wait: 400 })

  const query = useInfiniteQuery({
    queryKey: ['m-questions', status, search],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      questionsApi.getList({
        page: pageParam,
        size: PAGE_SIZE,
        ...(status ? { status } : {}),
        ...(search ? { search } : {}),
      }),
    getNextPageParam: (last, pages) => {
      const loaded = pages.length * PAGE_SIZE
      return loaded < last.total ? pages.length + 1 : undefined
    },
  })

  // 切换筛选/搜索时回到顶部,避免停在半空
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [status, search])

  const items: Question[] = useMemo(
    () => (query.data?.pages ?? []).flatMap((p) => p.data),
    [query.data],
  )
  const total = query.data?.pages?.[0]?.total ?? 0

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-6 pt-4">
      <div className="mb-3">
        <h1 className="font-serif text-[22px] leading-tight tracking-tight">题库</h1>
        <p className="mt-1 text-[12px] text-muted-foreground">共 {total} 题</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="搜索题目"
          className="h-10 pl-9 pr-9"
        />
        {searchInput ? (
          <button
            type="button"
            onClick={() => setSearchInput('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground"
            aria-label="清空搜索"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1 rounded-md border border-border p-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key || 'all'}
            type="button"
            onClick={() => setStatus(f.key)}
            className={cn(
              'rounded px-2 py-1.5 text-[12.5px] transition-colors',
              status === f.key
                ? 'bg-primary/12 font-medium text-primary ring-1 ring-inset ring-primary/30'
                : 'text-muted-foreground active:bg-muted',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {query.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[74px] animate-pulse rounded-lg border border-border bg-muted/40" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-12 text-center text-[13px] text-muted-foreground">
            没有符合条件的题目
          </div>
        ) : (
          items.map((q) => (
            <Link
              key={q.id}
              to={`/m/practice/${q.id}`}
              className="block rounded-lg border border-border bg-card px-3.5 py-3 transition-colors active:bg-muted/50"
            >
              <p className="line-clamp-2 font-serif text-[14.5px] leading-snug text-foreground">
                {q.title}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>{DIFFICULTY_TEXT[q.difficulty] ?? q.difficulty}</span>
                {q.techStack ? <span>{q.techStack}</span> : null}
                <span className={STATUS_TONE[q.stats.status]}>
                  {STATUS_TEXT[q.stats.status] ?? q.stats.status}
                </span>
                <span>练过 {q.stats.totalAttempts} 次</span>
              </div>
            </Link>
          ))
        )}
      </div>

      {query.hasNextPage ? (
        <Button
          variant="outline"
          className="mt-4 w-full"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          加载更多
        </Button>
      ) : null}
    </div>
  )
}
