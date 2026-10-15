import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { History } from 'lucide-react'
import { MdPreview } from 'md-editor-rt'
import 'md-editor-rt/lib/style.css'
import type { Question } from '../types'
import Drawer from '@/components/drawer'
interface QuestionPanelProps {
  question: Question
  questionId: string
  editorTheme: 'dark' | 'light'
  onOpenHistory: () => void
}

export function QuestionPanel({
  question,
  questionId,
  editorTheme,
  onOpenHistory,
}: QuestionPanelProps) {
  return (
    <div className="h-full flex flex-col overflow-hidden border-r">
      <Tabs defaultValue="content" className="flex-1 flex flex-col min-h-0">
        <div className="shrink-0 px-3 py-2 border-b flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="content">题目内容</TabsTrigger>
            <TabsTrigger value="answer">参考答案</TabsTrigger>
            <TabsTrigger value="drawer">结构绘制</TabsTrigger>
          </TabsList>
          <Button variant="ghost" size="sm" onClick={onOpenHistory} className="h-7">
            <History className="h-3 w-3 mr-1" />
            查看历史
          </Button>
        </div>

        {/* 题目内容 */}
        <TabsContent value="content" className="flex-1 min-h-0 m-0">
          <div className="h-full overflow-y-auto overflow-x-auto p-3 min-w-0">
            {question.content ? (
              <div className="w-full min-w-0">
                <MdPreview
                  id={`content-${questionId}`}
                  modelValue={question.content}
                  theme={editorTheme}
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                暂无内容
              </div>
            )}
          </div>
        </TabsContent>

        {/* 参考答案 */}
        <TabsContent value="answer" className="flex-1 min-h-0 m-0">
          <div className="h-full overflow-y-auto overflow-x-auto p-3 min-w-0">
            {question.answer ? (
              <div className="w-full min-w-0">
                <MdPreview
                  id={`answer-${questionId}`}
                  modelValue={question.answer}
                  theme={editorTheme}
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                暂无参考答案
              </div>
            )}
          </div>
        </TabsContent>

        {/* 绘图 */}
        <TabsContent value="drawer" className="flex-1 min-h-0 m-0">
          <div className="h-full overflow-y-auto overflow-x-auto p-3 min-w-0">
            <Drawer />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
