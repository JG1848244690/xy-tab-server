import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { statsApi, type IncompleteQuestion } from '@/services/stats-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PlayCircle } from 'lucide-react'

const IncompleteQuestionsList = () => {
  const navigate = useNavigate()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // 使用 useInfiniteQuery 实现无限滚动
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } =
    useInfiniteQuery({
      queryKey: ['incomplete-questions'],
      queryFn: ({ pageParam = 1 }) => statsApi.getIncompleteQuestions(pageParam, 10),
      getNextPageParam: (lastPage) => {
        return lastPage.hasMore ? lastPage.page + 1 : undefined
      },
      initialPageParam: 1,
    })

  // 滚动到底部时加载更多
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100

    if (isNearBottom && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // 获取所有页面的数据
  const allQuestions = data?.pages.flatMap((page) => page.data) || []

  // 难度颜色映射
  const difficultyColors = {
    easy: 'bg-green-500/10 text-green-500 border-green-500/20',
    medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    hard: 'bg-red-500/10 text-red-500 border-red-500/20',
  }

  const difficultyLabels = {
    easy: '简单',
    medium: '中等',
    hard: '困难',
  }

  const statusLabels = {
    not_started: '未开始',
    in_progress: '进行中',
    completed: '已完成',
  }

  const statusColors = {
    not_started: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    in_progress: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    completed: 'bg-green-500/10 text-green-500 border-green-500/20',
  }

  // 跳转到题目练习页面
  const handleStartPractice = (questionId: string) => {
    navigate(`/test-center/practice/${questionId}`)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">未完成题目</h3>
        {data && (
          <span className="text-sm text-muted-foreground">共 {data.pages[0]?.total || 0} 题</span>
        )}
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-muted-foreground">加载中...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-destructive">加载失败</div>
          </div>
        ) : allQuestions.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-muted-foreground">暂无未完成题目</div>
          </div>
        ) : (
          <>
            {allQuestions.map((question) => (
              <div
                key={question.id}
                className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
              >
                {/* 头部：状态 + 标题 + 难度 */}
                <div className="flex items-start gap-2 mb-2">
                  <Badge
                    variant="outline"
                    className={`${statusColors[question.stats.status]} shrink-0 h-5`}
                  >
                    {statusLabels[question.stats.status]}
                  </Badge>

                  <h4 className="text-sm font-medium line-clamp-1 flex-1 min-w-0">
                    {question.title}
                  </h4>

                  <Badge
                    variant="outline"
                    className={`${difficultyColors[question.difficulty]} shrink-0 h-5`}
                  >
                    {difficultyLabels[question.difficulty]}
                  </Badge>
                </div>

                {/* 底部：标签 + 开始练习按钮 */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    {question.tags && question.tags.length > 0 ? (
                      <>
                        {question.tags.slice(0, 2).map((tag, index) => (
                          <span
                            key={index}
                            className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary truncate"
                          >
                            {tag}
                          </span>
                        ))}
                        {question.tags.length > 2 && (
                          <span className="text-xs text-muted-foreground">
                            +{question.tags.length - 2}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {question.stats.totalAttempts > 0
                          ? `已尝试 ${question.stats.totalAttempts} 次`
                          : new Date(question.createdAt).toLocaleDateString('zh-CN', {
                              month: '2-digit',
                              day: '2-digit',
                            })}
                      </span>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={() => handleStartPractice(question.id)}
                  >
                    <PlayCircle className="h-3 w-3 mr-1" />
                    开始练习
                  </Button>
                </div>
              </div>
            ))}

            {isFetchingNextPage && (
              <div className="flex items-center justify-center py-4">
                <div className="text-sm text-muted-foreground">加载更多...</div>
              </div>
            )}

            {!hasNextPage && allQuestions.length > 0 && (
              <div className="flex items-center justify-center py-4">
                <div className="text-sm text-muted-foreground">没有更多了</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default IncompleteQuestionsList
