import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, X, Loader2, RotateCcw, Eye, Pencil } from 'lucide-react'
import { Markdown } from '@/components/markdown'

interface MarkdownEditorProps {
  userAnswer: string
  onAnswerChange: (value: string) => void
  isSubmitted: boolean
  isSubmitting: boolean
  onSubmitCorrect: () => void
  onSubmitWrong: () => void
  onRestart: () => void
}

/**
 * 理论题作答区:纯文本域 + Markdown 预览。
 * 之前用 md-editor-rt,它自带的预览样式和行号渲染跟纸色界面冲突,
 * 现在编辑用 textarea,预览用统一的 <Markdown>。
 */
export function MarkdownEditor({
  userAnswer,
  onAnswerChange,
  isSubmitted,
  isSubmitting,
  onSubmitCorrect,
  onSubmitWrong,
  onRestart,
}: MarkdownEditorProps) {
  const [preview, setPreview] = useState(false)

  return (
    <div className="h-full w-full min-w-0 max-w-full overflow-hidden flex flex-col">
      <div className="shrink-0 border-b border-border bg-card/60 px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">我的答案</h3>
          <div className="flex items-center rounded-md border border-border p-0.5">
            <button
              type="button"
              onClick={() => setPreview(false)}
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11.5px] transition-colors ${
                preview ? 'text-muted-foreground hover:text-foreground' : 'bg-card text-foreground'
              }`}
            >
              <Pencil className="h-3 w-3" />
              编辑
            </button>
            <button
              type="button"
              onClick={() => setPreview(true)}
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11.5px] transition-colors ${
                preview ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Eye className="h-3 w-3" />
              预览
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isSubmitted ? (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={onSubmitCorrect}
                disabled={isSubmitting || !userAnswer.trim()}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                正确
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={onSubmitWrong}
                disabled={isSubmitting || !userAnswer.trim()}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <X className="h-4 w-4 mr-1" />
                )}
                错误
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={onRestart}>
              <RotateCcw className="h-4 w-4 mr-1" />
              重新答题
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {preview ? (
          <div className="h-full overflow-y-auto p-4">
            {userAnswer.trim() ? (
              <Markdown>{userAnswer}</Markdown>
            ) : (
              <p className="text-sm text-muted-foreground">还没有内容,切回「编辑」开始写。</p>
            )}
          </div>
        ) : (
          <textarea
            value={userAnswer}
            onChange={(e) => {
              if (!isSubmitted) onAnswerChange(e.target.value)
            }}
            readOnly={isSubmitted}
            spellCheck={false}
            placeholder="支持 Markdown。先写结论,再补原理和边界。"
            className="h-full w-full resize-none border-0 bg-transparent p-4 font-mono text-[13px] leading-7 outline-none placeholder:text-muted-foreground/70"
          />
        )}
      </div>
    </div>
  )
}
