import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, FileQuestion, Loader2 } from 'lucide-react'
import { statsApi } from '@/services/stats-api'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export default function HomePage() {
  const navigate = useNavigate()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => statsApi.getDashboardStats(),
  })

  const formatTime = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), {
      addSuffix: true,
      locale: zhCN,
    })
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20'
      case 'medium':
        return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20'
      case 'hard':
        return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20'
      default:
        return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20'
    }
  }

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return '简单'
      case 'medium':
        return '中等'
      case 'hard':
        return '困难'
      default:
        return difficulty
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!stats) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">概览</h1>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* 题目统计 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">题目练习</CardTitle>
            <FileQuestion className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.questions.totalAttempts}</div>
            <p className="text-xs text-muted-foreground">
              正确 {stats.questions.totalCorrect} 题 · 正确率 {stats.questions.accuracy}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              本周新增 {stats.questions.thisWeekAdded} 题，答题 {stats.questions.thisWeekAttempted}{' '}
              次
            </p>
          </CardContent>
        </Card>

        {/* 打卡统计 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日打卡</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.todos.todayCompleted}/{stats.todos.todayTotal}
            </div>
            <p className="text-xs text-muted-foreground">已完成 {stats.todos.todayCompleted} 项</p>
            <p className="text-xs text-muted-foreground mt-1">
              本周完成率 {stats.todos.completionRate}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 最近活动 */}
      <div className="grid gap-4">
        {/* 最近添加的题目 */}
        <Card>
          <CardHeader>
            <CardTitle>最近添加的题目</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.questions.recentAdded.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">暂无最近添加的题目</div>
            ) : (
              <div className="space-y-4">
                {stats.questions.recentAdded.map((question) => (
                  <div
                    key={question.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors cursor-pointer"
                    onClick={() => navigate(`/test-center/practice/${question.id}`)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <FileQuestion className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-none truncate">
                          {question.title}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${getDifficultyColor(question.difficulty)}`}
                          >
                            {getDifficultyText(question.difficulty)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(question.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="ml-4 shrink-0">
                      开始练习
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 最近做的题目 */}
      {stats.questions.recentAttempted.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>最近做的题目</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.questions.recentAttempted.map((attempt) => (
                <div
                  key={attempt.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors cursor-pointer"
                  onClick={() => navigate(`/test-center/practice/${attempt.questionId}`)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                        attempt.isCorrect === 1
                          ? 'bg-green-100 dark:bg-green-900/20'
                          : 'bg-red-100 dark:bg-red-900/20'
                      }`}
                    >
                      {attempt.isCorrect === 1 ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <FileQuestion className="h-5 w-5 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-none truncate">
                        {attempt.questionTitle}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            attempt.isCorrect === 1
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                          }`}
                        >
                          {attempt.isCorrect === 1 ? '正确' : '错误'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(attempt.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="ml-4 shrink-0">
                    查看
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
