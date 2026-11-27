import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { request } from '@/lib/request'

interface Authorization {
  id: string
  clientName: string
  scopes: string[]
  expiresAt: string
  revokedAt: string | null
}

interface Authorizations {
  resource: string | null
  grants: Authorization[]
}

const clients = ['OpenCode', 'Claude Code', 'Codex', 'Pi'] as const
type Client = typeof clients[number]
const name = 'hlsedu-oauth'
const expiresFormat = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' })

function installInstructions(client: Client, url: string) {
  switch (client) {
    case 'OpenCode':
      return `opencode mcp add ${name} --url ${url}\nopencode mcp auth ${name}`
    case 'Claude Code':
      return `claude mcp add --transport http ${name} ${url}\nclaude mcp login ${name}`
    case 'Codex':
      return `codex mcp add ${name} --url ${url}\ncodex mcp login ${name}`
    case 'Pi':
      return `pi mcp add ${name} --url ${url}\npi mcp login ${name}`
  }
}

export default function McpOAuthCard({ userId }: { userId: string }) {
  const [client, setClient] = useState<Client>('OpenCode')
  const [copyStatus, setCopyStatus] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const queryKey = ['mcp-authorizations', userId]
  const authorizations = useQuery({
    queryKey,
    queryFn: async ({ signal }) => (await request.get<Authorizations>('/mcp-authorizations', { signal })).data,
  })
  const revoke = useMutation({
    mutationFn: (id: string) => request.delete(`/mcp-authorizations/${id}`, { headers: { 'X-Hls-Mcp-Management': '1' } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey })
      setConfirmId(null)
    },
  })
  if (!authorizations.data?.resource) return null
  const instructions = installInstructions(client, authorizations.data.resource)

  async function copyInstructions() {
    const prompt = `帮我连接 ${client} 到 hlsEdu MCP。保留已有的配置和密钥连接。请先完成添加步骤，再提示我在浏览器登录 hlsEdu 并同意访问。\n\n${instructions}`
    try {
      await navigator.clipboard.writeText(prompt)
      setCopyStatus('已复制，可以粘贴给 Agent。')
    } catch {
      setCopyStatus('无法访问剪贴板，请从下方复制。')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="font-serif text-base">MCP 连接</CardTitle>
        <CardDescription>在浏览器登录并授权，让 Agent 访问你的待办。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm">
            客户端
            <select aria-label="客户端" className="h-9 rounded-md border border-input bg-background px-3" value={client} onChange={(event) => {
              setClient(event.currentTarget.value as Client)
              setCopyStatus('')
            }}>
              {clients.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <Button variant="outline" type="button" onClick={() => void copyInstructions()}>复制给 Agent</Button>
        </div>
        {copyStatus && <p role="status" className="text-sm text-muted-foreground">{copyStatus}</p>}
        <pre className="overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">{instructions}</pre>
        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-medium">已授权的连接</h3>
          {authorizations.data.grants.length === 0 && <p className="mt-2 text-sm text-muted-foreground">浏览器授权后，连接会显示在这里。</p>}
          {revoke.isError && <p role="alert" className="mt-2 text-sm text-destructive">撤销失败，请重试。</p>}
          <ul className="divide-y divide-border">
            {authorizations.data.grants.map((grant) => (
              <li key={grant.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">{grant.clientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {grant.scopes.includes('todos:write') ? '读写待办' : '读取待办'} · {grant.revokedAt ? '已撤销' : `到期 ${expiresFormat.format(new Date(grant.expiresAt))}`}
                  </p>
                </div>
                {!grant.revokedAt && (confirmId === grant.id ? (
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" disabled={revoke.isPending} onClick={() => setConfirmId(null)}>取消</Button>
                    <Button size="sm" variant="destructive" disabled={revoke.isPending} onClick={() => revoke.mutate(grant.id)}>确认撤销</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" disabled={revoke.isPending} aria-label={`撤销 ${grant.clientName}`} onClick={() => {
                    revoke.reset()
                    setConfirmId(grant.id)
                  }}>撤销</Button>
                ))}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
