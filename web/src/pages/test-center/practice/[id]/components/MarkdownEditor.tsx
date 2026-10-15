import { Button } from '@/components/ui/button'
import { Check, X, Loader2, RotateCcw } from 'lucide-react'
import { MdEditor } from 'md-editor-rt'
import 'md-editor-rt/lib/style.css'

interface MarkdownEditorProps {
  userAnswer: string
  onAnswerChange: (value: string) => void
  editorTheme: 'dark' | 'light'
  isSubmitted: boolean
  isSubmitting: boolean
  onSubmitCorrect: () => void
  onSubmitWrong: () => void
  onRestart: () => void
}

export function MarkdownEditor({
  userAnswer,
  onAnswerChange,
  editorTheme,
  isSubmitted,
  isSubmitting,
  onSubmitCorrect,
  onSubmitWrong,
  onRestart,
}: MarkdownEditorProps) {
  return (
    <div className="h-full w-full min-w-0 max-w-full overflow-hidden flex flex-col border-l">
      <div className="shrink-0 px-3 py-2 border-b flex items-center justify-between">
        <h3 className="text-sm font-semibold">我的答案</h3>
        <div className="flex items-center gap-2">
          {!isSubmitted ? (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={onSubmitCorrect}
                disabled={isSubmitting || !userAnswer.trim()}
                className="bg-green-600 hover:bg-green-700 text-white"
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
                className="bg-red-600 hover:bg-red-700 text-white"
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
      <div className="flex-1 min-h-0" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <MdEditor
            modelValue={userAnswer}
            onChange={onAnswerChange}
            theme={editorTheme}
            language="zh-CN"
            readOnly={isSubmitted}
            toolbarsExclude={['github', 'save', 'htmlPreview', 'catalog']}
            previewTheme="default"
            style={{ height: '100%' }}
          />
        </div>
      </div>
    </div>
  )
}
