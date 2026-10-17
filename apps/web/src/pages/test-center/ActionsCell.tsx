import { useState } from 'react'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
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
import { store } from './store'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { questionsApi } from '@/services/questions-api'
import ConfirmDialog from '@/components/ConfirmDialog'

interface ActionsCellProps {
  question: Question
}

export function ActionsCell({ question }: ActionsCellProps) {
  const { open, updates } = store()
  const queryClient = useQueryClient()

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // 删除题目的 mutation
  const deleteMutation = useMutation({
    mutationFn: questionsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] })
      setDeleteDialogOpen(false)
    },
    onError: (error) => {
      console.error('删除题目失败:', error)
    },
  })

  const handleEdit = () => {
    updates({
      open: {
        ...(open as Record<string, unknown>),
        modal: true,
        editQuestionId: question.id,
      },
    })
  }

  const handleDelete = () => {
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    deleteMutation.mutate(question.id)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">打开菜单</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>操作</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(question.id)}>
            复制题目 ID
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            编辑题目
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            删除题目
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="确认删除"
        description={`确定要删除题目"${question.title}"吗？此操作不可恢复。`}
        confirmText="删除"
        cancelText="取消"
        onConfirm={confirmDelete}
      />
    </>
  )
}
