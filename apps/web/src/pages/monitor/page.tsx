import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, ArrowUpRight, Database, HardDrive, RefreshCw, ShieldAlert, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { monitorApi, type MonitorEvent, type MonitorSummary } from '@/services/monitor-api'
import { useAuthStore } from '@/store/auth-store'

const actions: Record<string, string> = {
  login: '登录', register_limit: '注册拦截', access_denied: '访问被拒绝', api_error: 'API 错误',
  practice: '提交练习', question_created: '创建题目', question_deleted: '删除题目',
  question_reviewed: '人工审核题目', admin_user_viewed: '管理员查看用户',
}

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
})
const date = (value?: string | null) => value ? dateFormatter.format(new Date(value)) : '暂无记录'

function bytes(value?: number | null) {
  if (value == null) return '—'
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`
  return `${Math.ceil(value / 1024)} KB`
}

const selectStyle = 'h-9 max-w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-ring'
const tableStyle = 'w-full whitespace-nowrap text-left text-sm [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-2 [&_th]:font-medium'

function RequestState({ error, retry, message }: { error: boolean; retry: () => void; message: string }) {
  return error ? (
    <div className="rounded-xl border border-border bg-card px-5 py-6 text-sm" role="alert">
      {message}加载失败。 <Button size="sm" variant="outline" onClick={retry}>重试</Button>
    </div>
  ) : <Skeleton className="h-48 rounded-xl" aria-label={`正在加载${message}`} role="status" />
}

function Paging({ page, hasMore, change }: { page: number; hasMore: boolean; change: (page: number) => void }) {
  if (page === 1 && !hasMore) return null
  return (
    <div className="flex items-center justify-end gap-3 border-t border-border px-4 py-3">
      <Button variant="outline" size="sm" disabled={page === 1} onClick={() => change(page - 1)}>上一页</Button>
      <span className="text-xs text-muted-foreground">第 {page} 页</span>
      <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => change(page + 1)}>下一页</Button>
    </div>
  )
}

function Status({ children, warn = false }: { children: React.ReactNode; warn?: boolean }) {
  return <span className={cn('text-xs font-medium', warn ? 'text-amber-800 dark:text-amber-300' : 'text-emerald-800 dark:text-emerald-300')}>{children}</span>
}

function Overview({ info, go }: { info: MonitorSummary; go: (tab: string) => void }) {
  const { host } = info
  const sample = host.snapshot
  const used = sample ? Math.max(0, Math.min(100, Math.round((1 - sample.disk.availableBytes / sample.disk.totalBytes) * 100))) : null
  const lastBackup = sample?.backup.latestSuccessAt
  const deployState = host.state === 'current' ? sample?.service.status === 'healthy' ? '运行正常' : '需要检查' : '等待采集'
  const alerts: { title: string; reason: string; tab: string }[] = []
  if (host.state !== 'current') alerts.push({ title: '宿主机指标待确认', reason: host.state === 'stale' ? '采集快照超过 12 分钟未更新' : '暂时没有可用的主机快照', tab: 'server' })
  if (host.state === 'current' && sample) {
    if (used !== null && used >= 80) alerts.push({ title: used >= 90 ? '磁盘空间告急' : '磁盘空间预警', reason: `根分区已使用 ${used}%`, tab: 'server' })
    if (sample.service.status !== 'healthy') alerts.push({ title: 'API 容器状态异常', reason: '宿主机采集未报告健康状态', tab: 'server' })
    if (!lastBackup || Date.now() - Date.parse(lastBackup) > 26 * 3600_000 || sample.backup.latest?.status === 'failed')
      alerts.push({ title: '需要检查数据库备份', reason: lastBackup ? `最近成功于 ${date(lastBackup)}` : '暂无成功记录', tab: 'server' })
    if (sample.backup.restoreDrill?.status === 'failed') alerts.push({ title: '恢复演练失败', reason: date(sample.backup.restoreDrill.at), tab: 'server' })
  }
  if (info.maxFailuresFromSource >= 10 || (info.failedLogins >= 20 && info.registrationBlocks >= 5))
    alerts.push({ title: '近期登录或注册异常', reason: `过去 15 分钟记录到 ${info.failedLogins} 次登录失败`, tab: 'events' })
  if (info.errors >= 5) alerts.push({ title: '接口错误偏多', reason: `过去 15 分钟记录到 ${info.errors} 次接口错误`, tab: 'events' })

  const metrics = [
    { label: '新注册', value: info.registrations, hint: '过去 24 小时', icon: Users, tab: 'users' },
    { label: '登录失败', value: info.failedLogins, hint: '过去 15 分钟 · 已记录', icon: ShieldAlert, tab: 'events' },
    { label: 'API 错误', value: info.errors, hint: '过去 15 分钟 · 已记录', icon: Activity, tab: 'events' },
    { label: '磁盘剩余', value: bytes(sample?.disk.availableBytes), hint: used === null ? '等待主机采集' : `根分区已用 ${used}%${host.state === 'stale' ? ' · 数据过期' : ''}`, icon: HardDrive, tab: 'server' },
  ]
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 divide-border rounded-xl border border-border bg-card lg:grid-cols-4 lg:divide-x">
        {metrics.map(({ label, value, hint, icon: Icon, tab }) => (
          <button key={label} type="button" className="group min-w-0 px-4 py-4 text-left hover:bg-muted/40 sm:px-5" onClick={() => go(tab)}>
            <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Icon aria-hidden="true" className="size-4" />{label}<ArrowUpRight aria-hidden="true" className="ml-auto hidden size-3.5 opacity-60 sm:block" /></span>
            <span className="mt-2 block font-serif text-2xl tabular-nums">{value}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 font-medium">需要关注</h2>
          {alerts.length ? <ul className="divide-y divide-border">{alerts.map((item) => (
            <li key={item.title}><button type="button" onClick={() => go(item.tab)} className="flex w-full items-center gap-3 py-3 text-left hover:text-primary">
              <ShieldAlert aria-hidden="true" className="size-4 shrink-0 text-amber-700 dark:text-amber-300" />
              <span className="min-w-0 flex-1"><span className="block text-sm">{item.title}</span><span className="mt-1 block text-xs text-muted-foreground">{item.reason}</span></span>
              <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
            </button></li>
          ))}</ul> : <p className="py-3 text-sm text-muted-foreground">当前指标未触发预警。</p>}
        </section>
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 font-medium">服务与备份</h2>
          <dl className="divide-y divide-border text-sm">
            <div className="flex justify-between gap-3 py-3"><dt>API 容器</dt><dd><Status warn={deployState !== '运行正常'}>{deployState}</Status></dd></div>
            <div className="flex justify-between gap-3 py-3"><dt>数据库</dt><dd><Status>连接正常</Status></dd></div>
            <div className="flex justify-between gap-3 py-3"><dt>最近成功备份</dt><dd className="tabular-nums text-muted-foreground">{date(lastBackup)}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  )
}

function Server({ info }: { info: MonitorSummary }) {
  const { state, snapshot } = info.host
  const status = { current: '采集正常', stale: '数据过期', unavailable: '暂时无法读取快照', unconfigured: '主机采集待配置' }[state]
  const serviceStatus = { healthy: '健康', starting: '启动中', unhealthy: '异常', stopped: '已停止', unknown: '未知' }
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-medium"><HardDrive className="size-4" />存储空间</h2>
        <p className="mt-2 text-xs text-muted-foreground">{status}{snapshot && ` · 采集于 ${date(snapshot.at)}`}</p>
        <dl className="mt-3 divide-y divide-border text-sm">
          {[
            ['根分区剩余 / 总量', snapshot ? `${bytes(snapshot.disk.availableBytes)} / ${bytes(snapshot.disk.totalBytes)}` : '—'],
            ['PostgreSQL 数据库', bytes(info.databaseBytes)], ['上传文件', bytes(snapshot?.storage.uploadsBytes)],
            ['备份目录', bytes(snapshot?.storage.backupsBytes)], ['主机日志与容器日志', bytes(snapshot?.storage.logsBytes)],
          ].map(([label, value]) => <div key={label} className="flex justify-between gap-3 py-3"><dt>{label}</dt><dd className="tabular-nums text-muted-foreground">{value}</dd></div>)}
        </dl>
      </section>
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-medium"><Database className="size-4" />部署与备份</h2>
        <dl className="mt-3 divide-y divide-border text-sm">
          {[
            ['API 容器', snapshot ? serviceStatus[snapshot.service.status] : '—'],
            ['发布版本', snapshot?.service.release ?? '—'], ['容器启动时间', date(snapshot?.service.startedAt)],
            ['最近备份任务', snapshot?.backup.latest ? `${snapshot.backup.latest.status === 'ok' ? '成功' : '失败'} · ${date(snapshot.backup.latest.at)}` : '暂无记录'],
            ['最近成功备份', date(snapshot?.backup.latestSuccessAt)],
            ['最近恢复演练', snapshot?.backup.restoreDrill ? `${snapshot.backup.restoreDrill.status === 'ok' ? '通过' : '失败'} · ${date(snapshot.backup.restoreDrill.at)}` : '暂无记录'],
          ].map(([label, value]) => <div key={label} className="flex justify-between gap-3 py-3"><dt className="shrink-0">{label}</dt><dd className="break-all text-right tabular-nums text-muted-foreground">{value}</dd></div>)}
        </dl>
      </section>
    </div>
  )
}

function EventRows({ queryScope }: { queryScope: string[] }) {
  const [action, setAction] = useState('security')
  const [page, setPage] = useState(1)
  const result = useQuery({ queryKey: [...queryScope, 'events', page, action], queryFn: () => monitorApi.events({ page, action }), retry: false })
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div><h2 className="font-medium">安全与操作事件</h2><p className="mt-1 text-xs text-muted-foreground">近 30 天 · 仅事件摘要 · 北京时间</p></div>
        <select aria-label="筛选事件类型" value={action} className={selectStyle} onChange={(event) => { setAction(event.target.value); setPage(1) }}>
          <option value="security">全部安全事件</option>{Object.entries(actions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>
      {result.isPending || result.isError ? <RequestState error={result.isError} retry={() => void result.refetch()} message="事件" /> : (
        <><div className="overflow-x-auto"><table className={tableStyle}>
          <thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th>时间</th><th>事件</th><th>账号</th><th>结果</th><th>来源指纹</th><th>请求 ID</th></tr></thead>
          <tbody className="divide-y divide-border">{result.data.data.map((event) => (
            <tr key={event.id}><td className="tabular-nums">{date(event.createdAt)}</td><td>{actions[event.action] ?? event.action}</td>
              <td>{event.actor ?? event.actorId?.slice(0, 8) ?? '—'}</td><td><Status warn={event.status >= 400}>{event.status}</Status></td>
              <td className="font-mono text-xs text-muted-foreground">{event.source ?? '—'}</td>
              <td><code className="select-all text-xs text-muted-foreground" title={event.requestId ?? undefined}>{event.requestId ?? '—'}</code></td></tr>
          ))}{!result.data.data.length && <tr><td colSpan={6} className="text-center text-muted-foreground">没有符合条件的事件</td></tr>}</tbody>
        </table></div><Paging page={page} hasMore={result.data.hasMore} change={setPage} /></>
      )}
    </section>
  )
}

function UserDetail({ id, close, queryScope }: { id: string; close: () => void; queryScope: string[] }) {
  const result = useQuery({ queryKey: [...queryScope, 'user', id], queryFn: () => monitorApi.user(id), gcTime: 0, refetchOnWindowFocus: false, retry: false })
  const user = result.data?.user
  const events: MonitorEvent[] = user ? [
    { id: 'registered', action: 'registered', status: 200, createdAt: user.createdAt },
    ...(user.verifiedAt ? [{ id: 'verified', action: 'verified', status: 200, createdAt: user.verifiedAt }] : []),
    ...result.data!.activity,
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)) : []
  return (
    <Dialog open onOpenChange={(open) => { if (!open) close() }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{user?.name ?? '用户详情'}</DialogTitle><DialogDescription>账号操作时间线 · 北京时间</DialogDescription></DialogHeader>
        {result.isError || result.isPending ? <RequestState error={result.isError} retry={() => void result.refetch()} message="用户详情" /> : <>
          <p className="text-sm text-muted-foreground">{user?.email} · {user?.role === 'admin' ? '管理员' : '普通用户'}</p>
          <ul className="divide-y divide-border border-y border-border" aria-label="用户操作时间线">{events.map((event) => (
            <li key={event.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span>{event.action === 'registered' ? '创建账号' : event.action === 'verified' ? '验证邮箱' : (actions[event.action] ?? event.action)}</span>
              <time dateTime={event.createdAt} className="text-xs tabular-nums text-muted-foreground">{date(event.createdAt)}</time>
            </li>
          ))}</ul>
        </>}
      </DialogContent>
    </Dialog>
  )
}

function UserRows({ queryScope, initialFilter }: { queryScope: string[]; initialFilter: string }) {
  const [filter, setFilter] = useState(initialFilter)
  const [search, setSearch] = useState('')
  const [q, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const result = useQuery({ queryKey: [...queryScope, 'users', page, filter, q], queryFn: () => monitorApi.users({ page, filter, q }), retry: false })
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <h2 className="font-medium">用户列表</h2>
        <form className="flex min-w-0 flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); setPage(1) }}>
          <select className={selectStyle} aria-label="筛选用户" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1) }}>
            <option value="all">全部用户</option><option value="day">近 24 小时注册</option><option value="week">近 7 天注册</option><option value="unverified">未验证邮箱</option>
          </select>
          <Input className="w-44" aria-label="搜索用户" placeholder="搜索昵称" maxLength={100} value={search} onChange={(event) => setSearch(event.target.value)} />
          <Button variant="outline" type="submit">搜索</Button>
        </form>
      </div>
      {result.isPending || result.isError ? <RequestState error={result.isError} retry={() => void result.refetch()} message="用户" /> : (
        <><div className="overflow-x-auto"><table className={tableStyle}>
          <thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th>用户</th><th>角色</th><th>邮箱状态</th><th>注册时间</th><th>最近登录</th><th><span className="sr-only">操作</span></th></tr></thead>
          <tbody className="divide-y divide-border">{result.data.data.map((user) => (
            <tr key={user.id}><td><span className="block max-w-60 truncate font-medium">{user.name ?? '未设置昵称'}</span><span className="text-xs text-muted-foreground">{user.email}</span></td>
              <td>{user.role === 'admin' ? '管理员' : '普通用户'}</td><td><Status warn={!user.verifiedAt}>{user.verifiedAt ? '已验证' : '待验证'}</Status></td>
              <td className="tabular-nums">{date(user.createdAt)}</td><td className="tabular-nums text-muted-foreground">{date(user.lastLogin)}</td>
              <td className="text-right"><Button variant="ghost" size="sm" aria-label={`查看 ${user.name ?? '用户'} 的详情`} onClick={() => setSelected(user.id)}>查看详情 <ArrowUpRight className="size-3.5" /></Button></td></tr>
          ))}{!result.data.data.length && <tr><td colSpan={6} className="text-center text-muted-foreground">没有符合条件的用户</td></tr>}</tbody>
        </table></div><Paging page={page} hasMore={result.data.hasMore} change={setPage} /></>
      )}
      {selected && <UserDetail id={selected} close={() => setSelected(null)} queryScope={queryScope} />}
    </section>
  )
}

export default function MonitorPage() {
  const user = useAuthStore((state) => state.user)
  if (user?.role !== 'admin') return <p className="px-5 py-12 text-center text-sm text-muted-foreground">系统监控仅对管理员开放。</p>
  return <MonitorConsole key={user.id} userId={user.id} />
}

function MonitorConsole({ userId }: { userId: string }) {
  const queryScope = ['monitor', userId]
  const [tab, setTab] = useState('overview')
  const [userFilter, setUserFilter] = useState('all')
  const client = useQueryClient()
  const summary = useQuery({ queryKey: [...queryScope, 'summary'], queryFn: monitorApi.summary, refetchInterval: 60_000, retry: false })
  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-foreground/60 pb-4">
        <div><h1 className="font-serif text-[28px] leading-tight">系统监控</h1><p className="mt-2 text-sm text-muted-foreground">用户活动、安全事件与服务器状态</p></div>
        <div className="flex items-center gap-3">
          {summary.data?.host.snapshot?.source === 'demo' && <span className="text-xs font-medium text-amber-800 dark:text-amber-300">本地演示快照</span>}
          <Button variant="outline" size="sm" disabled={summary.isFetching} onClick={() => void client.invalidateQueries({ queryKey: queryScope, predicate: (query) => query.queryKey[2] !== 'user' })}><RefreshCw className="size-3.5" />刷新</Button>
        </div>
      </header>
      <Tabs value={tab} onValueChange={(value) => { setUserFilter('all'); setTab(value) }}>
        <TabsList className="max-w-full justify-start"><TabsTrigger value="overview">总览</TabsTrigger><TabsTrigger value="users">用户</TabsTrigger><TabsTrigger value="events">安全事件</TabsTrigger><TabsTrigger value="server">服务器</TabsTrigger></TabsList>
        <TabsContent value="overview" className="pt-2">{summary.isPending || summary.isError ? <RequestState error={summary.isError} retry={() => void summary.refetch()} message="总览" /> : <Overview info={summary.data} go={(value) => { setUserFilter(value === 'users' ? 'day' : 'all'); setTab(value) }} />}</TabsContent>
        <TabsContent value="users" className="pt-2"><UserRows queryScope={queryScope} initialFilter={userFilter} /></TabsContent>
        <TabsContent value="events" className="pt-2"><EventRows queryScope={queryScope} /></TabsContent>
        <TabsContent value="server" className="pt-2">{summary.isPending || summary.isError ? <RequestState error={summary.isError} retry={() => void summary.refetch()} message="服务器" /> : <Server info={summary.data} />}</TabsContent>
      </Tabs>
    </div>
  )
}
