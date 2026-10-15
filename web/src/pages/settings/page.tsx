import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/store/auth-store'
import { User, UserCircle } from 'lucide-react'
import { assetUrl } from '@/lib/env'

export default function SettingsPage() {
  const { user } = useAuthStore()

  return (
    <div className="h-full w-full flex flex-col ">
      <div className="shrink-0 px-6 py-6 border-b">
        <h1 className="text-3xl font-bold">个人设置</h1>
        <p className="text-muted-foreground mt-2">管理您的账户信息</p>
      </div>

      <Tabs defaultValue="profile" className="flex-1 flex  flex-col min-h-0 w-full  items-start">
        <TabsList className="shrink-0 mt-6 flex w-[40%] mx-auto ">
          <TabsTrigger value="profile" className="flex w-[10%] items-center gap-2">
            <UserCircle className="h-4 w-4" />
            个人信息
          </TabsTrigger>
        </TabsList>

        {/* 个人信息 Tab */}
        <TabsContent
          value="profile"
          className="flex-1 w-[50%] mx-auto min-h-0 overflow-y-auto px-6 py-6"
        >
          <div className=" mx-auto space-y-6">
            {/* 头像 */}
            <Card>
              <CardHeader>
                <CardTitle>头像</CardTitle>
                <CardDescription>您的个人头像</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-6">
                  <div className="shrink-0">
                    <div className="w-32 h-32 rounded-full bg-linear-to-br from-blue-400 to-purple-500 flex items-center justify-center overflow-hidden shadow-lg">
                      {user?.avatarPath ? (
                        <img
                          src={assetUrl(user.avatarPath)}
                          alt="当前头像"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-16 h-16 text-white" />
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 账户信息 */}
            <Card>
              <CardHeader>
                <CardTitle>账户信息</CardTitle>
                <CardDescription>您的基本账户信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>用户名</Label>
                    <Input value={user?.name || '未设置'} disabled className="bg-muted" />
                  </div>

                  <div className="space-y-2">
                    <Label>邮箱</Label>
                    <Input value={user?.email || ''} disabled className="bg-muted" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
