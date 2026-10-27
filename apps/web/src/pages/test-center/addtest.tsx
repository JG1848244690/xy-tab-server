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
import { reviewApi, type GeneratedQuestion } from '@/services/review-api'
import { uploadEditorImages } from '@/services/media-api'
import { QuotaBadge } from '@/components/ai-quota-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { CircleAlert, Loader2, Sparkles, Wand2 } from 'lucide-react'

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
  /** AI 回填/外部改值后递增,作为 MdEditor 的 key 强制同步内容 */
  const [editorRevision, setEditorRevision] = useState(0)
  const [isDataLoaded, setIsDataLoaded] = useState(false) // 标记数据是否已加载并填充
  /** AI 自动出题:粘贴的原始知识点 */
  const [aiSource, setAiSource] = useState('')
  const [aiError, setAiError] = useState<string | null>(null)
  /** 三轮 agent 自查出的"需人工核实"点 */
  const [aiCaveats, setAiCaveats] = useState<string[]>([])
  const [aiMeta, setAiMeta] = useState<{
    steps: number
    needsResearch: boolean
  } | null>(null)
  const [aiNotice, setAiNotice] = useState<string | null>(null)

  /** 把 AI 生成的题目写进表单(强制重挂载编辑器,避免 modelValue 同步问题) */
  const applyGenerated = (question: GeneratedQuestion) => {
    setFormData((prev) => ({
      ...prev,
      type: question.type,
      title: question.title,
      content: question.content,
      answer: question.answer,
      difficulty: question.difficulty,
      tags: question.tags,
    }))
    setEditorRevision((n) => n + 1)
    setTagsInput(question.tags.join(','))
  }

  const resetAiState = () => {
    setAiCaveats([])
    setAiMeta(null)
    setAiNotice(null)
  }

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
        resetAiState()
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
      resetAiState()
      // 关闭对话框,并提示"新题去了审核中心"(2026-10-26:题库只显示已过审的题)
      updates({        open: { ...(open as Record<string, unknown>), modal: false, editQuestionId: undefined },
        notice: `「${data.title}」已提交 AI 审核,通过后才会出现在题库`,
      })
      queryClient.invalidateQueries({ queryKey: ['review-queue'] })
    },
    onError: (error) => {
      console.error('创建题目失败:', error)
      // 可以在这里添加错误提示
    },
  })

  // AI 自动出题:粘贴知识点 → 生成完整题目(只填表单,用户可改)
  const aiGenerate = useMutation({
    mutationFn: () =>
      reviewApi.generate({
        source: aiSource.trim(),
        type: formData.type,
        difficulty: formData.difficulty,
      }),
    onSuccess: ({ question, caveats, meta }) => {
      setAiError(null)
      // 函数式更新 + 重挂载编辑器(见 applyGenerated 注释),避免 onChange 覆盖
      applyGenerated(question)
      setAiCaveats(caveats ?? [])
      setAiMeta(meta ? { steps: meta.steps, needsResearch: meta.needsResearch } : null)
      setAiNotice(null)
      queryClient.invalidateQueries({ queryKey: ['ai-quota'] })
    },
    onError: (error) => setAiError(error instanceof Error ? error.message : 'AI 生成失败'),
  })

  // AI 自动出题 + 直接创建并送审(一键)
  const aiCreate = useMutation({
    mutationFn: async () => {
      const result = await reviewApi.generate({
        source: aiSource.trim(),
        type: formData.type,
        difficulty: formData.difficulty,
      })
      // 有不确定项就不自动提交:填进表单,让用户核对后再手动提交
      if (result.caveats?.length) {
        applyGenerated(result.question)
        setAiCaveats(result.caveats)
        setAiMeta(
          result.meta
            ? { steps: result.meta.steps, needsResearch: result.meta.needsResearch }
            : null,
        )
        setAiNotice(
          `AI 自查有 ${result.caveats.length} 处需要核实,已先填入表单、未自动提交。请核对后再提交审核。`,
        )
        return null
      }
      return questionsApi.create({
        ...result.question,
        visibility: formData.visibility ?? 'shared',
      })
    },
    onSuccess: (data) => {
      if (!data) return
      setAiError(null)
      setAiSource('')
      setAiCaveats([])
      setAiMeta(null)
      setAiNotice(null)
      queryClient.invalidateQueries({ queryKey: ['questions'] })
      queryClient.invalidateQueries({ queryKey: ['ai-quota'] })
      queryClient.invalidateQueries({ queryKey: ['review-queue'] })
      updates({
        open: { ...(open as Record<string, unknown>), modal: false, editQuestionId: undefined },
        notice: `「${data.title}」已由 AI 生成并提交审核,通过后才会出现在题库`,
      })
    },
    onError: (error) => setAiError(error instanceof Error ? error.message : 'AI 生成失败'),
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
      resetAiState()
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
      setAiSource('')
      setAiError(null)
      resetAiState()
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
            {!isEditMode && (
              <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Wand2 className="h-4 w-4 text-primary" />
                    AI 自动出题
                  </span>
                  <span className="text-xs text-muted-foreground">
                    粘贴知识点 / 文档片段 / AI 回答,自动生成完整题目
                  </span>
                </div>
                <Textarea
                  value={aiSource}
                  onChange={(e) => setAiSource(e.target.value)}
                  rows={4}
                  placeholder="把知识点、文档片段或 AI 的回答粘贴到这里(20-8000 字)…"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={
                      aiSource.trim().length < 20 || aiGenerate.isPending || aiCreate.isPending
                    }
                    onClick={() => aiGenerate.mutate()}
                  >
                    {aiGenerate.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4" />
                    )}
                    AI 生成题目
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      aiSource.trim().length < 20 || aiGenerate.isPending || aiCreate.isPending
                    }
                    onClick={() => aiCreate.mutate()}
                  >
                    {aiCreate.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    生成并提交审核
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    「AI 生成」只填表单可再改;「生成并提交」直接送审 —— 若自查有不确定项,会先填表不提交
                  </span>
                </div>
                {aiGenerate.isPending || aiCreate.isPending ? (
                  <p className="text-xs text-muted-foreground">
                    正在做 3 步事实核查(草稿 → 质疑 → 终稿),约 20-40 秒…
                  </p>
                ) : null}
                {aiError ? (
                  <p className="flex items-center gap-1 text-xs text-destructive">
                    <CircleAlert className="h-3.5 w-3.5" />
                    {aiError}
                  </p>
                ) : null}
                {aiCaveats.length > 0 ? (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                    <p className="flex flex-wrap items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
                      <CircleAlert className="h-3.5 w-3.5" />
                      AI 自查提示(提交前请核对)
                      {aiMeta ? (
                        <span className="font-normal text-muted-foreground">
                          · {aiMeta.steps} 步核查
                          {aiMeta.needsResearch ? ' · 含需联网核实项' : ''}
                        </span>
                      ) : null}
                    </p>
                    {aiNotice ? (
                      <p className="mt-1 text-amber-700/90 dark:text-amber-200/90">
                        {aiNotice}
                      </p>
                    ) : null}
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-amber-800/90 dark:text-amber-200/90">
                      {aiCaveats.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="type">题目类型 *</Label>
                <Select
                  value={formData.type}
                  onChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      type: value as 'markdown' | 'text',
                    }))
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
                    setFormData((prev) => ({
                      ...prev,
                      difficulty: value as 'easy' | 'medium' | 'hard',
                    }))
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
                    setFormData((prev) => ({
                      ...prev,
                      visibility: value as 'shared' | 'private',
                    }))
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
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
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

            <div className="grid grid-cols-1 gap-4 w-full lg:grid-cols-2">
              <div className="space-y-2 w-full min-w-0">
                <Label htmlFor="content">题目内容 *</Label>
                <div className="w-full min-w-0" style={{ overflow: 'hidden' }}>
                  <div style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
                    {(!isEditMode || isDataLoaded) && (
                      <MdEditor
                        key={`content-${editQuestionId || 'new'}-${isDataLoaded}-${editorRevision}`}
                        modelValue={formData.content || ''}
                        onChange={(value) =>
                          setFormData((prev) => ({ ...prev, content: value || '' }))
                        }
                        language="zh-CN"
                        theme={editorTheme}
                        previewTheme={editorTheme === 'dark' ? 'dark' : 'github'}
                        codeTheme={editorTheme === 'dark' ? 'dark' : 'github'}
                        style={editorStyle}
                        onUploadImg={uploadEditorImages}
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
                        key={`answer-${editQuestionId || 'new'}-${isDataLoaded}-${editorRevision}`}
                        modelValue={formData.answer || ''}
                        onChange={(value) =>
                          setFormData((prev) => ({ ...prev, answer: value || '' }))
                        }
                        language="zh-CN"
                        theme={editorTheme}
                        previewTheme={editorTheme === 'dark' ? 'dark' : 'github'}
                        codeTheme={editorTheme === 'dark' ? 'dark' : 'github'}
                        style={editorStyle}
                        onUploadImg={uploadEditorImages}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              图片:直接粘贴/拖拽进编辑器会自动上传到图库并插入链接(也可手动写{' '}
              <code className="rounded bg-muted px-1 py-0.5">
                {'![图片说明](https://static.kskbl.com.cn/uploads/...)'}
              </code>
              )。
            </p>

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
