import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Check, X, Loader2, RotateCcw, Play } from 'lucide-react'
import Editor from '@monaco-editor/react'
import { useState } from 'react'

interface CodeEditorProps {
  userAnswer: string
  onAnswerChange: (value: string) => void
  monacoTheme: 'vs-dark' | 'light'
  isSubmitted: boolean
  isSubmitting: boolean
  onSubmitCorrect: () => void
  onSubmitWrong: () => void
  onRestart: () => void
}

export function CodeEditor({
  userAnswer,
  onAnswerChange,
  monacoTheme,
  isSubmitted,
  isSubmitting,
  onSubmitCorrect,
  onSubmitWrong,
  onRestart,
}: CodeEditorProps) {
  const [codeOutput, setCodeOutput] = useState<string>('')
  const [isRunningCode, setIsRunningCode] = useState(false)
  const editorLanguage = 'javascript' // 默认使用 JavaScript

  // 运行代码（仅支持 JavaScript）
  const handleRunCode = () => {
    if (!userAnswer.trim()) {
      setCodeOutput('请先输入代码')
      return
    }

    if (editorLanguage !== 'javascript') {
      setCodeOutput('当前仅支持运行 JavaScript 代码')
      return
    }

    setIsRunningCode(true)
    setCodeOutput('运行中...\n')

    // 捕获 console 输出
    let output = ''
    const originalLog = console.log
    const originalError = console.error
    const originalWarn = console.warn
    const originalInfo = console.info
    const originalDebug = console.debug

    const captureOutput =
      (prefix: string) =>
      (...args: any[]) => {
        output +=
          prefix +
          args
            .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
            .join(' ') +
          '\n'
      }

    console.log = captureOutput('')
    console.error = captureOutput('ERROR: ')
    console.warn = captureOutput('WARN: ')
    console.info = captureOutput('INFO: ')
    console.debug = captureOutput('DEBUG: ')

    try {
      // 使用 Function 构造函数执行代码（相对安全）
      const func = new Function(userAnswer)
      const result = func()

      // 等待异步操作完成（最多等待 5 秒）
      const maxWaitTime = 5000
      const startTime = Date.now()

      const checkAsync = () => {
        const elapsed = Date.now() - startTime
        if (elapsed < maxWaitTime) {
          // 继续等待异步操作
          setTimeout(checkAsync, 100)
        } else {
          // 恢复原始 console
          console.log = originalLog
          console.error = originalError
          console.warn = originalWarn
          console.info = originalInfo
          console.debug = originalDebug

          if (result !== undefined) {
            output += `返回值: ${typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)}\n`
          }

          setCodeOutput(output || '代码执行完成，无输出')
          setIsRunningCode(false)
        }
      }

      // 如果代码中有异步操作，等待一段时间
      setTimeout(() => {
        checkAsync()
      }, 100)
    } catch (error: any) {
      // 恢复原始 console
      console.log = originalLog
      console.error = originalError
      console.warn = originalWarn
      console.info = originalInfo
      console.debug = originalDebug

      setCodeOutput(`错误: ${error.message}\n${error.stack || ''}`)
      setIsRunningCode(false)
    }
  }

  return (
    <div className="h-full w-full min-w-0 max-w-full overflow-hidden flex flex-col border-l">
      <Tabs defaultValue="editor" className="flex-1 flex flex-col min-h-0">
        {/* Tab 头部 - 与左侧题目面板高度一致 */}
        <div className="shrink-0 px-3 py-2 border-b flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="editor">在线编辑</TabsTrigger>
            <TabsTrigger value="output">运行结果</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            {!isSubmitted ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRunCode}
                  disabled={isRunningCode || !userAnswer.trim()}
                >
                  {isRunningCode ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-1" />
                  )}
                  运行
                </Button>
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

        {/* 编辑器内容 */}
        <TabsContent value="editor" className="flex-1 min-h-0 m-0">
          <div className="h-full">
            <Editor
              height="100%"
              language={editorLanguage}
              theme={monacoTheme}
              value={userAnswer}
              onChange={(value) => !isSubmitted && onAnswerChange(value || '')}
              options={{
                readOnly: isSubmitted,
                minimap: { enabled: true },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                automaticLayout: true,
                tabSize: 2,
                insertSpaces: true,
                formatOnPaste: true,
                formatOnType: true,
                suggestOnTriggerCharacters: true,
                acceptSuggestionOnEnter: 'on',
                quickSuggestions: true,
                parameterHints: { enabled: true },
                bracketPairColorization: { enabled: true },
                folding: true,
                foldingStrategy: 'auto',
                showFoldingControls: 'always',
                matchBrackets: 'always',
                autoIndent: 'full',
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
                renderWhitespace: 'selection',
                renderLineHighlight: 'all',
                occurrencesHighlight: 'off',
                selectionHighlight: true,
              }}
            />
          </div>
        </TabsContent>

        {/* 运行结果内容 */}
        <TabsContent value="output" className="flex-1 min-h-0 m-0">
          <div className="h-full p-4 bg-muted/50 overflow-auto">
            <pre className="text-sm font-mono whitespace-pre-wrap">
              {codeOutput || '点击"运行"按钮执行 JavaScript 代码，输出将显示在这里...'}
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
