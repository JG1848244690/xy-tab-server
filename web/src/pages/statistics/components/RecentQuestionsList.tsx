import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { statsApi } from '@/services/stats-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PlayCircle, CheckCircle } from 'lucide-react'

const RecentQuestionsList = () => {
  const navigate = useNavigate()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<'added' | 'completed'>('added')

  // 最近添加的题目
  const {
    data: addedData,
    fetchNextPage: fetchNextAdded,
    hasNextPage: hasNextAdded,
    isFetchingNextPage: isFetchingNextAdded,
    isLoading: isLoadingAdded,
  } = useInfiniteQuery({
    queryKey: ['recent-added-questions'],
    queryFn: ({ pageParam = 1 }) => statsApi.getRecentAddedQuestions(pageParam, 10),
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.page + 1 : undefined
    },
    initialPageParam: 1,
    enabled: activeTab === 'added',
  })

  // 最近完成的题目
  const {
    data: completedData,
    fetchNextPage: fetchNextCompleted,
    hasNextPage: hasNextCompleted,
    isFetchingNextPage: isFetchingNextCompleted,
    isLoading: isLoadingCompleted,
  } = useInfiniteQuery({
    queryKey: ['recent-completed-questions'],
    queryFn: ({ pageParam = 1 }) => statsApi.getRecentCompletedQuestions(pageParam, 10),
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.page + 1 : undefined
    },
    initialPageParam: 1,
    enabled: activeTab === 'completed',
  })

  // 滚动到底部时加载更多
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100

    if (activeTab === 'added') {
      if (isNearBottom && hasNextAdded && !isFetchingNextAdded) {
        fetchNextAdded()
      }
    } else {
      if (isNearBottom && hasNextCompleted && !isFetchingNextCompleted) {
        fetchNextCompleted()
      }
    }
  }, [
    activeTab,
    hasNextAdded,
    isFetchingNextAdded,
    fetchNextAdded,
    hasNextCompleted,
    isFetchingNextCompleted,
    fetchNextCompleted,
  ])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // 获取当前显示的数据
  const currentData =
    activeTab === 'added'
      ? addedData?.pages.flatMap((page) => page.data) || []
      : completedData?.pages.flatMap((page) => page.data) || []

  const isLoading = activeTab === 'added' ? isLoadingAdded : isLoadingCompleted
  const isFetchingNext = activeTab === 'added' ? isFetchingNextAdded : isFetchingNextCompleted
  const hasNext = activeTab === 'added' ? hasNextAdded : hasNextCompleted

  // 难度颜色映射
  const difficultyColors: Record<string, string> = {
    easy: 'bg-green-500/10 text-green-500 border-green-500/20',
    medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    hard: 'bg-red-500/10 text-red-500 border-red-500/20',
  }

  const difficultyLabels: Record<string, string> = {
    easy: '简单',
    medium: '中等',
    hard: '困难',
  }

  // 跳转到题目练习页面
  const handleViewQuestion = (questionId: string) => {
    navigate(`/test-center/practice/${questionId}`)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'added' | 'completed')}
        >
          <TabsList>
            <TabsTrigger value="added">最近添加</TabsTrigger>
            <TabsTrigger value="completed">最近完成</TabsTrigger>
          </TabsList>
        </Tabs>
        {currentData.length > 0 && (
          <span className="text-sm text-muted-foreground">
            共 {activeTab === 'added' ? addedData?.pages[0]?.total : completedData?.pages[0]?.total}{' '}
            题
          </span>
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
        ) : currentData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-muted-foreground">
              {activeTab === 'added' ? '暂无最近添加的题目' : '暂无已完成的题目'}
            </div>
          </div>
        ) : (
          <>
            {currentData.map((question: any) => (
              <div
                key={question.id}
                className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
              >
                {/* 头部：标题 + 难度 */}
                <div className="flex items-start gap-2 mb-2">
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

                {/* 底部：标签/信息 + 查看按钮 */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    {question.tags && question.tags.length > 0 ? (
                      <>
                        {question.tags.slice(0, 2).map((tag: string, index: number) => (
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
                        {activeTab === 'added'
                          ? new Date(question.createdAt).toLocaleDateString('zh-CN', {
                              month: '2-digit',
                              day: '2-digit',
                            })
                          : `${new Date(question.completedAt).toLocaleDateString('zh-CN', {
                              month: '2-digit',
                              day: '2-digit',
                            })} · ${question.totalAttempts}次`}
                      </span>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={() => handleViewQuestion(question.id)}
                  >
                    {activeTab === 'added' ? (
                      <>
                        <PlayCircle className="h-3 w-3 mr-1" />
                        开始练习
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        查看详情
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}

            {isFetchingNext && (
              <div className="flex items-center justify-center py-4">
                <div className="text-sm text-muted-foreground">加载更多...</div>
              </div>
            )}

            {!hasNext && currentData.length > 0 && (
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

export default RecentQuestionsList
