import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { env } from '@/lib/env'
import { request } from '@/lib/request'

interface McpKey {
  id: string
  name: string
  canWrite: boolean
  expiresAt: string
}

const managementHeaders = { 'X-Hls-Mcp-Management': '1' }
const fieldClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring'
const dateFormat = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })

const setKeyCommand = [
  '& {',
  "  $mcpSecret = Read-Host 'Paste your hlsEdu MCP key' -AsSecureString",
  "  $mcpKey = [System.Net.NetworkCredential]::new('', $mcpSecret).Password",
  "  if ($mcpKey -cnotmatch '^hlse_mcp_[A-Za-z0-9_-]{43}$') { throw 'Invalid hlsEdu MCP key format' }",
  "  [Environment]::SetEnvironmentVariable('HLSEDU_MCP_KEY', $mcpKey, 'User')",
  '  $env:HLSEDU_MCP_KEY = $mcpKey',
  "  Write-Host 'hlsEdu MCP key saved. Restart OpenCode to use it.'",
  '}',
].join('\n')

function opencodeSetupInstructions(config: string) {
  return [
    '请在当前项目为 OpenCode 安装 hlsEdu MCP。',
    '先检查 OpenCode 版本和项目现有的 opencode.json 或 opencode.jsonc。保留现有配置和其他 MCP，只合并 hlsedu 这一项。OpenCode 2 使用下面的 mcp.servers.hlsedu；OpenCode 1 则将 hlsedu 放在 mcp 下。',
    '',
    '```json',
    config,
    '```',
    '',
    '保留 Authorization 中的环境变量引用。密钥由我在运行 OpenCode 的本机终端输入，请不要在聊天里索要密钥或把明文写进配置。若未设置密钥，告诉我在 hlsEdu「个人设置 → MCP 密钥 → OpenCode 接入详情」复制并运行 PowerShell 命令。',
    '配置完成后用 opencode mcp list 检查 hlsedu 的连接状态。刚设置密钥时，请提示我重新启动 OpenCode，包括仍在运行的后台进程，然后再验证。报告实际状态，无需创建测试待办。',
  ].join('\n')
}

function errorMessage(error: unknown, fallback: string) {
  if (isAxiosError<{ message?: string }>(error) && error.response?.data?.message) {
    return error.response.data.message
  }
  return fallback
}

export default function McpKeysCard({ userId }: { userId: string }) {
  const queryClient = useQueryClient()
  const queryKey = ['mcp-keys', userId]
  const keys = useQuery({
    queryKey,
    queryFn: async ({ signal }) => (await request.get<McpKey[]>('/mcp-keys', { signal })).data,
  })
  const [formOpen, setFormOpen] = useState(false)
  const [token, setToken] = useState('')
  const [pending, setPending] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [keyCopyStatus, setKeyCopyStatus] = useState('')
  const [setupCopyStatus, setSetupCopyStatus] = useState('')
  const [showSetup, setShowSetup] = useState(false)

  const mcpUrl = new URL(`${env.apiBase.replace(/\/$/, '')}/mcp`, window.location.origin).href
  const config = JSON.stringify({
    $schema: 'https://opencode.ai/config.json',
    mcp: {
      servers: {
        hlsedu: {
          type: 'remote',
          url: mcpUrl,
          oauth: false,
          headers: { Authorization: 'Bearer {env:HLSEDU_MCP_KEY}' },
        },
      },
    },
  }, null, 2)
  const setupInstructions = opencodeSetupInstructions(config)

  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError('')
    try {
      const { data } = await request.post<McpKey & { token: string }>('/mcp-keys', {
        name: form.get('name'),
        access: form.get('access'),
        expiresInDays: Number(form.get('expiresInDays')),
      }, { headers: managementHeaders })
      const { token: newToken, ...key } = data
      setToken(newToken)
      setKeyCopyStatus('')
      setFormOpen(false)
      queryClient.setQueryData<McpKey[]>(queryKey, (previous) => [key, ...(previous ?? [])])
      void queryClient.invalidateQueries({ queryKey })
    } catch (error) {
      setError(errorMessage(error, '创建失败，请重试。'))
    } finally {
      setPending(false)
    }
  }

  async function revokeKey(id: string) {
    setPending(true)
    setError('')
    try {
      await request.delete(`/mcp-keys/${id}`, { headers: managementHeaders })
      queryClient.setQueryData<McpKey[]>(queryKey, (previous) => previous?.filter((key) => key.id !== id))
      void queryClient.invalidateQueries({ queryKey })
      setRevoking(null)
    } catch (error) {
      setError(errorMessage(error, '撤销失败，请重试。'))
    } finally {
      setPending(false)
    }
  }

  async function copyText(text: string, onStatus: (status: string) => void, success: string, revealSetup = false) {
    try {
      await navigator.clipboard.writeText(text)
      onStatus(success)
    } catch {
      onStatus('无法访问剪贴板，请手动复制。')
      if (revealSetup) setShowSetup(true)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle role="heading" aria-level={2} className="font-serif text-base">MCP 密钥</CardTitle>
            <CardDescription>让 OpenCode 访问你的 hlsEdu 待办。</CardDescription>
          </div>
          {!formOpen && !token && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => {
              setError('')
              setRevoking(null)
              setFormOpen(true)
            }}>创建密钥</Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {formOpen && (
          <form className="space-y-3 rounded-md border border-border p-3" onSubmit={(event) => void createKey(event)}>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <label className="space-y-1.5 text-sm">
                <span>名称</span>
                <Input name="name" placeholder="例如 OpenCode" required maxLength={80} autoFocus />
              </label>
              <label className="space-y-1.5 text-sm">
                <span>权限</span>
                <select className={fieldClass} name="access">
                  <option value="read">读取待办</option>
                  <option value="read_write">读写待办</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span>有效期</span>
                <select className={fieldClass} name="expiresInDays" defaultValue="30">
                  <option value="7">7 天</option>
                  <option value="30">30 天</option>
                  <option value="90">90 天</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" type="button" disabled={pending} onClick={() => setFormOpen(false)}>取消</Button>
              <Button size="sm" type="submit" disabled={pending}>{pending ? '创建中…' : '生成密钥'}</Button>
            </div>
          </form>
        )}
        {token && (
          <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
            <p className="text-sm font-medium">密钥只展示一次，请现在复制保存。</p>
            <Input readOnly value={token} aria-label="新建的 MCP 密钥" data-sentry-block className="font-mono text-xs" onFocus={(event) => event.currentTarget.select()} />
            <p role="status" className="text-sm text-muted-foreground">{keyCopyStatus}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void copyText(token, setKeyCopyStatus, '已复制密钥。')}>复制密钥</Button>
              <Button size="sm" variant="ghost" onClick={() => setToken('')}>关闭</Button>
            </div>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {keys.isPending && <p role="status" className="text-sm text-muted-foreground">正在加载密钥…</p>}
        {keys.isError && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p role="alert" className="text-sm text-destructive">密钥列表加载失败。</p>
            <Button size="sm" variant="outline" onClick={() => void keys.refetch()}>重试</Button>
          </div>
        )}
        {keys.data?.length === 0 && <p className="text-sm text-muted-foreground">还没有 MCP 密钥。</p>}
        {keys.data && keys.data.length > 0 && (
          <ul className="divide-y divide-border border-y border-border">
            {keys.data.map((key) => (
              <li key={key.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">{key.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {key.canWrite ? '读写待办' : '读取待办'} · {new Date(key.expiresAt).getTime() <= Date.now() ? '已到期' : '到期'} {dateFormat.format(new Date(key.expiresAt))}
                  </p>
                </div>
                {revoking === key.id ? (
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => setRevoking(null)}>取消</Button>
                    <Button size="sm" variant="destructive" disabled={pending} onClick={() => void revokeKey(key.id)}>
                      {pending ? '撤销中…' : '确认撤销'}
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" disabled={pending || formOpen} aria-label={`撤销 ${key.name}`} onClick={() => {
                    setError('')
                    setRevoking(key.id)
                  }}>撤销</Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-2 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">把安装说明发给 OpenCode，让它替你配置。</p>
            <Button size="sm" variant="outline" onClick={() => void copyText(setupInstructions, setSetupCopyStatus, '已复制安装说明，可以粘贴给 OpenCode。', true)}>
              复制给 OpenCode
            </Button>
          </div>
          <p role="status" className="text-sm text-muted-foreground">{setupCopyStatus}</p>
          <details className="text-sm" open={showSetup} onToggle={(event) => setShowSetup(event.currentTarget.open)}>
            <summary className="cursor-pointer font-medium">OpenCode 接入详情</summary>
            <p className="mt-2 text-muted-foreground">在运行 OpenCode 的电脑上，把下方命令粘贴到 PowerShell。出现提示后，再粘贴密钥并按回车，然后重新启动 OpenCode。</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void copyText(setKeyCommand, setSetupCopyStatus, '已复制 PowerShell 命令。')}>复制密钥设置命令</Button>
            </div>
            <pre className="mt-2 overflow-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-xs">{setKeyCommand}</pre>
            <details className="mt-3">
              <summary className="cursor-pointer font-medium">查看安装说明</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-3 font-mono text-xs">{setupInstructions}</pre>
            </details>
          </details>
        </div>
      </CardContent>
    </Card>
  )
}
