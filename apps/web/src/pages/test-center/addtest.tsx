// 导入store
import { useState, useEffect, useMemo } from 'react'
import { useTheme } from 'next-themes'
import { store } from './store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Select from '@/components/ui/select'
import { MdEditor } from 'md-editor-rt'
import 'md-editor-rt/lib/style.css'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { questionsApi, CreateQuestionDto } from '@/services/questions-api'
import { QuotaBadge } from '@/components/ai-quota-badge'
import { Skeleton } from '@/components/ui/skeleton'

// 添加样式确保 MdEditor 不会溢出
const editorStyle = {
  height: '400px',
  width: '100%',
  maxWidth: '100%',
}

const Modal = () => {
  const { open, updates } = store()
  const queryClient = useQueryClient()
  const { resolvedTheme } = useTheme()
  const editorTheme = resolvedTheme === 'dark' ? 'dark' : 'light'

  const editQuestionId = open.editQuestionId as string | undefined
  const isEditMode = !!editQuestionId

  const [formData, setFormData] = useState<CreateQuestionDto>({
    type: 'markdown',
    title: '',
    content: '',
    answer: '',
    difficulty: 'medium',
    tags: [],
    visibility: 'shared',
  })

  const [tagsInput, setTagsInput] = useState('') // 用于输入标签，以逗号分隔
  const [isDataLoaded, setIsDataLoaded] = useState(false) // 标记数据是否已加载并填充

  // 如果是编辑模式，加载题目数据
  const {
    data: questionData,
    isLoading: isLoadingQuestion,
    isFetching: isFetchingQuestion,
  } = useQuery({
    queryKey: ['question', editQuestionId],
    queryFn: () => questionsApi.getOne(editQuestionId!),
    enabled: isEditMode && !!editQuestionId && !!open.modal, // 只有在编辑模式且模态框打开时才加载
    staleTime: 0, // 禁用缓存，确保每次都获取最新数据
  })

  // 当加载到题目数据时，填充表单
  useEffect(() => {
    if (questionData && isEditMode && !isLoadingQuestion && !isFetchingQuestion && open.modal) {
      // 确保数据完整后再填充
      setFormData({
        type: questionData.type,
        title: questionData.title || '',
        content: questionData.content || '',
        answer: questionData.answer || '',
        difficulty: questionData.difficulty || 'medium',
        tags: questionData.tags || [],
        visibility: questionData.visibility || 'shared',
      })
      setTagsInput(questionData.tags?.join(',') || '')
      setIsDataLoaded(true)
    } else if (!open.modal) {
      // 模态框关闭时重置所有状态
      setIsDataLoaded(false)
      if (!isEditMode) {
        // 如果不是编辑模式，重置表单
        setFormData({
          type: 'markdown',
          title: '',
          content: '',
          answer: '',
          difficulty: 'medium',
          tags: [],
          visibility: 'shared',
        })
        setTagsInput('')
      }
    }
  }, [questionData, isEditMode, open.modal, isLoadingQuestion, isFetchingQuestion])

  // 当编辑ID变化时，重置数据加载状态
  useEffect(() => {
    if (isEditMode && editQuestionId) {
      setIsDataLoaded(false)
    }
  }, [editQuestionId, isEditMode])

  // 计算是否应该显示loading
  const showLoading = useMemo(() => {
    return isEditMode && open.modal && (isLoadingQuestion || isFetchingQuestion || !isDataLoaded)
  }, [isEditMode, open.modal, isLoadingQuestion, isFetchingQuestion, isDataLoaded])

  // 创建题目的 mutation
  const createMutation = useMutation({
    mutationFn: questionsApi.create,
    onSuccess: (data) => {
      // 刷新题目列表（如果有相关查询）
      queryClient.invalidateQueries({ queryKey: ['questions'] })
      // 新题自动送 AI 审核消耗了配额,刷新徽章
      queryClient.invalidateQueries({ queryKey: ['ai-quota'] })
      // 刷新刚创建的题目详情，确保数据是最新的
      queryClient.invalidateQueries({ queryKey: ['question', data.id] })
      // 重置表单
      setFormData({
        type: 'markdown',
        title: '',
        content: '',
        answer: '',
        difficulty: 'medium',
        tags: [],
        visibility: 'shared',
      })
      setTagsInput('')
      // 关闭对话框,并提示"新题去了审核中心"(2026-10-26:题库只显示已过审的题)
      updates({
        open: { ...(open as Record<string, unknown>), modal: false, editQuestionId: undefined },
        notice: `「${data.title}」已提交 AI 审核,通过后才会出现在题库`,
      })
      queryClient.invalidateQueries({ queryKey: ['review-queue'] })
    },
    onError: (error) => {
      console.error('创建题目失败:', error)
      // 可以在这里添加错误提示
    },
  })

  // 更新题目的 mutation
  const updateMutation = useMutation({
    mutationFn: (data: CreateQuestionDto) => questionsApi.update(editQuestionId!, data),
    onSuccess: () => {
      // 刷新题目列表
      queryClient.invalidateQueries({ queryKey: ['questions'] })
      queryClient.invalidateQueries({ queryKey: ['question', editQuestionId] })
      // 重置表单
      setFormData({
        type: 'markdown',
        title: '',
        content: '',
        answer: '',
        difficulty: 'medium',
        tags: [],
        visibility: 'shared',
      })
      setTagsInput('')
      // 关闭对话框
      updates({
        open: { ...(open as Record<string, unknown>), modal: false, editQuestionId: undefined },
      })
    },
    onError: (error) => {
      console.error('更新题目失败:', error)
      // 可以在这里添加错误提示
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // 处理标签
    const tags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)

    const submitData = {
      ...formData,
      tags: tags.length > 0 ? tags : undefined,
    }

    if (isEditMode) {
      updateMutation.mutate(submitData)
    } else {
      createMutation.mutate(submitData)
    }
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      // 关闭时重置所有状态
      setIsDataLoaded(false)
      setFormData({
        type: 'markdown',
        title: '',
        content: '',
        answer: '',
        difficulty: 'medium',
        tags: [],
        visibility: 'shared',
      })
      setTagsInput('')
    }
    updates({
      open: {
        ...(open as Record<string, unknown>),
        modal: isOpen,
        editQuestionId: isOpen ? open.editQuestionId : undefined,
      },
    })
  }

  return (
    <Dialog open={open.modal as boolean} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw]! w-[95vw]! sm:max-w-[95vw]! max-h-[95vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            {isEditMode ? '编辑题目' : '添加题目'}
            {/* AI 配额可见(防滥用):新题保存即自动送 AI 前置审核,消耗 1 次 */}
            <QuotaBadge />
          </DialogTitle>
        </DialogHeader>

        {showLoading ? (
          <div className="space-y-4 w-full min-w-0 py-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-100 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-100 w-full" />
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 w-full min-w-0">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">题目类型 *</Label>
                <Select
                  value={formData.type}
                  onChange={(value) =>
                    setFormData({ ...formData, type: value as 'markdown' | 'text' })
                  }
                  options={[
                    { label: '代码题', value: 'markdown' },
                    { label: '理论题', value: 'text' },
                  ]}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="difficulty">难度</Label>
                <Select
                  value={formData.difficulty || 'medium'}
                  onChange={(value) =>
                    setFormData({ ...formData, difficulty: value as 'easy' | 'medium' | 'hard' })
                  }
                  options={[
                    { label: '简单', value: 'easy' },
                    { label: '中等', value: 'medium' },
                    { label: '困难', value: 'hard' },
                  ]}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="visibility">可见性</Label>
                <Select
                  value={formData.visibility || 'shared'}
                  onChange={(value) =>
                    setFormData({ ...formData, visibility: value as 'shared' | 'private' })
                  }
                  options={[
                    { label: '共享(所有人可见)', value: 'shared' },
                    { label: '私有(仅自己)', value: 'private' },
                  ]}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">题目标题 *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="请输入题目标题"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">标签</Label>
              <Input
                id="tags"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="请输入标签，多个标签用逗号分隔，如：数组,ES6,闭包"
              />
              <p className="text-sm text-muted-foreground">多个标签请用逗号分隔</p>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full">
              <div className="space-y-2 w-full min-w-0">
                <Label htmlFor="content">题目内容 *</Label>
                <div className="w-full min-w-0" style={{ overflow: 'hidden' }}>
                  <div style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
                    {(!isEditMode || isDataLoaded) && (
                      <MdEditor
                        key={`content-${editQuestionId || 'new'}-${isDataLoaded}`}
                        modelValue={formData.content || ''}
                        onChange={(value) => setFormData({ ...formData, content: value || '' })}
                        language="zh-CN"
                        theme={editorTheme}
                        previewTheme={editorTheme === 'dark' ? 'dark' : 'github'}
                        codeTheme={editorTheme === 'dark' ? 'dark' : 'github'}
                        style={editorStyle}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2 w-full min-w-0">
                <Label htmlFor="answer">参考答案 *</Label>
                <div className="w-full min-w-0" style={{ overflow: 'hidden' }}>
                  <div style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
                    {(!isEditMode || isDataLoaded) && (
                      <MdEditor
                        key={`answer-${editQuestionId || 'new'}-${isDataLoaded}`}
                        modelValue={formData.answer || ''}
                        onChange={(value) => setFormData({ ...formData, answer: value || '' })}
                        language="zh-CN"
                        theme={editorTheme}
                        previewTheme={editorTheme === 'dark' ? 'dark' : 'github'}
                        codeTheme={editorTheme === 'dark' ? 'dark' : 'github'}
                        style={editorStyle}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={createMutation.isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending
                  ? isEditMode
                    ? '更新中...'
                    : '创建中...'
                  : isEditMode
                    ? '更新题目'
                    : '创建题目'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
export default Modal
