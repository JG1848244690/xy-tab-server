import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { Link } from 'react-router-dom'
import CodeList from './codeList'
import StrList from './strList'
import Modal from './addtest'
import { store } from './store'
import { useAuthStore } from '@/store/auth-store'
const TestCenter = () => {
  const { updates, notice } = store()
  const role = useAuthStore((s) => s.user?.role)
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
      {notice && (
        <div className="mb-4 mr-32 flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span>{notice}</span>
          <div className="flex flex-none items-center gap-2">
            {role === 'admin' && (
              <Button asChild size="sm" variant="outline">
                <Link to="/review">去审核</Link>
              </Button>
            )}
            <button
              className="text-muted-foreground hover:text-foreground"
              onClick={() => updates({ notice: null })}
              aria-label="关闭提示"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
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
