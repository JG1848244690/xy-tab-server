import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, Filter } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Question } from '@/services/questions-api'
import { ActionsCell } from './ActionsCell'

import { useNavigate } from 'react-router-dom'

// 提取为独立组件以正确使用 Hooks
const TitleCell = ({ row }: { row: any }) => {
  const navigate = useNavigate()
  const isPrivate = row.original.visibility === 'private'
  return (
    <div
      className="text-center font-medium hover:underline cursor-pointer inline-flex items-center gap-1 justify-center"
      onClick={() => navigate(`/test-center/practice/${row.original.id}`)}
    >
      {row.getValue('title')}
      {isPrivate && (
        <span className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
          私有
        </span>
      )}
    </div>
  )
}

export const columns: ColumnDef<Question>[] = [
  {
    accessorKey: 'title',
    header: ({ table }) => {
      const ordering = (table.options.meta as any)?.currentFilter?.ordering
      const isAsc = ordering === 'title'
      const isDesc = ordering === '-title'
      return (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={() => table.options.meta?.onSort?.('title')}>
            题目标题
            <ArrowUpDown className={`ml-2 h-4 w-4 ${isAsc || isDesc ? 'text-blue-500' : ''}`} />
          </Button>
        </div>
      )
    },
    cell: ({ row }) => <TitleCell row={row} />,
  },
  {
    accessorKey: 'difficulty',
    header: ({ table }) => {
      const currentFilter = (table.options.meta as any)?.currentFilter?.difficulty
      return (
        <div className="flex justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost">
                难度
                <Filter className={`ml-2 h-4 w-4 ${currentFilter ? 'text-blue-500' : ''}`} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuLabel>筛选难度</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => table.options.meta?.onFilterChange?.('difficulty', '')}
              >
                全部
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => table.options.meta?.onFilterChange?.('difficulty', 'easy')}
              >
                简单
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => table.options.meta?.onFilterChange?.('difficulty', 'medium')}
              >
                中等
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => table.options.meta?.onFilterChange?.('difficulty', 'hard')}
              >
                困难
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    },
    cell: ({ row }) => {
      const difficulty = row.getValue('difficulty') as string
      const difficultyMap: Record<string, { text: string; color: string }> = {
        easy: {
          text: '简单',
          color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        },
        medium: {
          text: '中等',
          color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        },
        hard: { text: '困难', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
      }
      const diff = difficultyMap[difficulty] || {
        text: difficulty,
        color: 'bg-gray-100 text-gray-800',
      }
      return (
        <div className="text-center">
          <span className={`px-2 py-1 rounded text-xs font-medium ${diff.color}`}>{diff.text}</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'stats.status',
    header: ({ table }) => {
      const currentFilter = (table.options.meta as any)?.currentFilter?.status
      return (
        <div className="flex justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost">
                状态
                <Filter className={`ml-2 h-4 w-4 ${currentFilter ? 'text-blue-500' : ''}`} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuLabel>筛选状态</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => table.options.meta?.onFilterChange?.('status', '')}>
                全部
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => table.options.meta?.onFilterChange?.('status', 'not_started')}
              >
                未开始
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => table.options.meta?.onFilterChange?.('status', 'in_progress')}
              >
                进行中
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => table.options.meta?.onFilterChange?.('status', 'completed')}
              >
                已完成
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    },
    cell: ({ row }) => {
      const stats = row.original.stats
      const statusMap: Record<string, string> = {
        not_started: '未开始',
        in_progress: '进行中',
        completed: '已完成',
      }
      return (
        <div className="text-center font-medium">{statusMap[stats.status] || stats.status}</div>
      )
    },
  },
  {
    accessorKey: 'stats.totalAttempts',
    header: ({ table }) => {
      const ordering = (table.options.meta as any)?.currentFilter?.ordering
      const isAsc = ordering === 'stats.totalAttempts'
      const isDesc = ordering === '-stats.totalAttempts'
      return (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => table.options.meta?.onSort?.('stats.totalAttempts')}
          >
            尝试次数
            <ArrowUpDown className={`ml-2 h-4 w-4 ${isAsc || isDesc ? 'text-blue-500' : ''}`} />
          </Button>
        </div>
      )
    },
    cell: ({ row }) => {
      const stats = row.original.stats
      return <div className="text-center font-medium">{stats.totalAttempts}</div>
    },
  },
  {
    accessorKey: 'tags',
    header: () => {
      return <div className="text-center">标签</div>
    },
    cell: ({ row }) => {
      const tags = (row.getValue('tags') as string[]) || []
      return (
        <div className="text-center px-2">
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1 justify-center items-center min-h-8">
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded max-w-full truncate inline-block"
                  title={tag}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">--</span>
          )}
        </div>
      )
    },
  },
  // {
  //     header: () => <div className="text-center">开始答题</div>,
  //     id: "start",
  //     cell: ({ row }) => {
  //         return (
  //             <div className="flex justify-center items-center">
  //                 <StartPracticeButton questionId={row.original.id} />
  //             </div>
  //         )
  //     },
  // },
  {
    header: '操作',
    id: 'actions',
    cell: ({ row }) => {
      return <ActionsCell question={row.original} />
    },
  },
]
