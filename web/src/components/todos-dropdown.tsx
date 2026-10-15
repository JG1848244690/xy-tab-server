import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { todosApi, Todo } from '@/services/todos-api'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Circle, Clock, Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export function TodosDropdown() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  // 获取今日日期
  const today = new Date().toISOString().split('T')[0]

  // 获取今日 todos
  // enabled: open 表示只在打开时发起新的请求
  // 但如果缓存中已有数据（比如从 todos 页面获取过），会直接使用缓存数据
  const { data: todos = [], isLoading } = useQuery({
    queryKey: ['todos', today],
    queryFn: () => todosApi.getTodosByDate(today),
    enabled: open, // 只在打开时获取数据（但会使用缓存）
  })

  // 切换完成状态
  const toggleMutation = useMutation({
    mutationFn: (id: string) => todosApi.toggleComplete(id),
    onSuccess: () => {
      // 使相关查询失效，触发重新获取
      queryClient.invalidateQueries({ queryKey: ['todos', today] })
      // 同时使月度状态失效，确保日历视图同步（使用与 todos 页面相同的查询键格式）
      const now = new Date()
      queryClient.invalidateQueries({
        queryKey: ['monthStatus', now.getFullYear(), now.getMonth() + 1],
      })
      // 也使所有日期的 todos 查询失效，确保其他日期视图也同步
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })

  // 双击处理
  const handleDoubleClick = (todo: Todo) => {
    toggleMutation.mutate(todo.id)
  }

  // 格式化时间范围
  const formatTimeRange = (startTime: string, endTime: string) => {
    return `${startTime} - ${endTime}`
  }

  // 统计完成情况
  const completedCount = todos.filter((t) => t.completed).length
  const totalCount = todos.length

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <CheckCircle2 className="h-5 w-5" />
          {totalCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
              {totalCount - completedCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[400px] overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>今日打卡</span>
          {totalCount > 0 && (
            <span className="text-xs text-muted-foreground font-normal">
              {completedCount}/{totalCount} 已完成
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : todos.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">今日暂无打卡任务</div>
        ) : (
          <div className="py-1">
            {todos.map((todo) => (
              <DropdownMenuItem
                key={todo.id}
                className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                onSelect={(e) => {
                  // 阻止点击 item 时关闭下拉框
                  e.preventDefault()
                }}
                onDoubleClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleDoubleClick(todo)
                }}
                disabled={toggleMutation.isPending}
              >
                <div className="flex items-start gap-2 w-full">
                  <div className="mt-0.5 shrink-0">
                    {todo.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        'text-sm font-medium wrap-break-word',
                        todo.completed && 'line-through text-muted-foreground'
                      )}
                    >
                      {todo.content}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatTimeRange(todo.startTime, todo.endTime)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1 w-full pl-6">
                  双击切换完成状态
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
