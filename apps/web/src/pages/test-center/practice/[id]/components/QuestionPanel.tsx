import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { History } from 'lucide-react'
import { Markdown } from '@/components/markdown'
import type { Question } from '../types'
import Drawer from '@/components/drawer'

interface QuestionPanelProps {
  question: Question
  questionId: string
  onOpenHistory: () => void
}

export function QuestionPanel({
  question,
  questionId,
  onOpenHistory,
}: QuestionPanelProps) {
  /**
   * 存量导入的题里有 160/297 道 content 只是标题(≤20 字),
   * 真正的解析都在 answer 里。这种情况直接打开「参考答案」。
   */
  const contentIsStub = (question.content ?? '').trim().length < 20
  const defaultTab = contentIsStub && question.answer ? 'answer' : 'content'

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col min-h-0">
        <div className="shrink-0 border-b border-border bg-card/60 px-3 py-2 flex items-center justify-between">
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
          <div className="h-full overflow-y-auto overflow-x-auto p-4 min-w-0">
            {question.content?.trim() ? (
              <Markdown>{question.content}</Markdown>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                暂无内容,直接看「参考答案」即可
              </div>
            )}
          </div>
        </TabsContent>

        {/* 参考答案 */}
        <TabsContent value="answer" className="flex-1 min-h-0 m-0">
          <div className="h-full overflow-y-auto overflow-x-auto p-4 min-w-0">
            {question.answer?.trim() ? (
              <Markdown>{question.answer}</Markdown>
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
