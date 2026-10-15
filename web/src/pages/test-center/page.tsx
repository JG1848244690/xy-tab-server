import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import CodeList from './codeList'
import StrList from './strList'
import Modal from './addtest'
import { store } from './store'
const TestCenter = () => {
  const { updates } = store()
  return (
    <div className="w-full h-full  relative">
      <Button
        className="absolute right-0 top-0"
        onClick={() => {
          const { open } = store.getState()
          updates({ open: { ...(open as Record<string, unknown>), modal: true } })
        }}
      >
        添加题目
      </Button>
      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">代码测试</TabsTrigger>
          <TabsTrigger value="password">理论测试</TabsTrigger>
        </TabsList>
        <TabsContent value="account" className="w-full">
          <CodeList />
        </TabsContent>
        <TabsContent value="password">
          <StrList />
        </TabsContent>
      </Tabs>
      <Modal />
    </div>
  )
}
export default TestCenter
