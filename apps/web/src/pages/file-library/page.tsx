import { useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { ArrowLeft, Copy, Download, File, Film, Folder, FolderPlus, Image, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { env } from '@/lib/env'
import { request } from '@/lib/request'
import { useAuthStore } from '@/store/auth-store'

type Library = 'static' | 'private'
interface Entry {
  name: string
  path: string
  directory: boolean
  mime: string | null
  bytes: number | null
}

const publicHost = 'https://static.kskbl.com.cn'
const mutationHeader = { 'X-Hls-File-Library': '1' }
const accepted = '.jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.mp4,.mov,.webm,.pdf,.zip'
const sizeFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 })
const isImage = (entry: Entry) => entry.mime?.startsWith('image/')
const isVideo = (entry: Entry) => entry.mime?.startsWith('video/')

function sizeLabel(bytes: number) {
  if (bytes >= 1024 ** 2) return `${sizeFormat.format(bytes / 1024 ** 2)} MB`
  if (bytes >= 1024) return `${sizeFormat.format(bytes / 1024)} KB`
  return `${bytes} B`
}

function errorText(error: unknown) {
  const message = isAxiosError<{ message?: string }>(error) ? error.response?.data?.message : undefined
  if (typeof message === 'string') return message
  if (isAxiosError(error) && error.response?.status === 413) return '单个文件最多 48 MB。'
  return '操作失败，请重试。'
}

export default function FileLibraryPage({ library }: { library: Library }) {
  const userId = useAuthStore((state) => state.user?.id)
  const ownsLibrary = useAuthStore((state) => state.user?.fileLibraries === true)
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const fileInput = useRef<HTMLInputElement>(null)
  const [path, setPath] = useState(() => library === 'static' && searchParams.get('folder') === 'assets' ? 'assets' : '')
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [preview, setPreview] = useState<Entry | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [failure, setFailure] = useState('')
  const [copiedLink, setCopiedLink] = useState('')
  const [previewError, setPreviewError] = useState(false)

  const isPrivate = library === 'private'
  const title = isPrivate ? '私人图库' : '资源管理'
  const endpoint = `/file-library/${library}`
  const queryKey = ['file-library', userId, library]
  const listing = useQuery({
    queryKey: [...queryKey, path, appliedQuery, page],
    enabled: ownsLibrary,
    retry: false,
    queryFn: async ({ signal }) => (await request.get<{ items: Entry[]; total: number; pageSize: number }>(endpoint + '/list', {
      params: { path, q: appliedQuery, page }, signal,
    })).data,
  })
  const canUpload = !isPrivate && (path === 'assets' || path.startsWith('assets/'))
  const trail = path ? path.split('/') : []
  const pages = listing.data ? Math.max(1, Math.ceil(listing.data.total / listing.data.pageSize)) : 1

  function mediaUrl(entry: Entry, inline = false) {
    return `${env.apiBase.replace(/\/$/, '')}${endpoint}/file?${new URLSearchParams({ path: entry.path, ...(inline ? { preview: '1' } : {}) })}`
  }

  function openFolder(folder: string) {
    if (busy) return
    setPath(folder)
    setQuery('')
    setAppliedQuery('')
    setPage(1)
    setCreateOpen(false)
    setFailure('')
    setStatus('')
    setCopiedLink('')
  }

  function openPreview(entry: Entry) {
    setPreviewError(false)
    setPreview(entry)
  }

  async function copyLink(entry: Entry) {
    const link = publicHost + '/' + entry.path.split('/').map(encodeURIComponent).join('/')
    try {
      await navigator.clipboard.writeText(link)
      setCopiedLink('')
      setStatus('已复制公网链接。')
    } catch {
      setCopiedLink(link)
      setStatus('请手动复制下方链接。')
    }
  }

  async function upload(files: File[]) {
    if (!canUpload || busy || !files.length) return
    const failed: string[] = []
    let completed = 0
    setBusy(true)
    setFailure('')
    setCopiedLink('')
    try {
      for (const file of files) {
        setStatus(`正在上传 ${file.name}（${completed + failed.length + 1}/${files.length}）`)
        try {
          await request.post(endpoint + '/upload', file, {
            params: { path, name: file.name },
            headers: { ...mutationHeader, 'Content-Type': 'application/octet-stream' },
          })
          completed++
        } catch (error) {
          failed.push(`${file.name}：${errorText(error)}`)
        }
      }
      await queryClient.invalidateQueries({ queryKey })
      setStatus(completed ? `已上传 ${completed} 个文件。` : '')
      if (failed.length) setFailure(failed.join('\n'))
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function newFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = String(new FormData(event.currentTarget).get('name') ?? '').trim()
    setBusy(true)
    setFailure('')
    try {
      await request.post(endpoint + '/folder', { path, name }, { headers: mutationHeader })
      await queryClient.invalidateQueries({ queryKey })
      setCreateOpen(false)
      setStatus('文件夹已创建。')
    } catch (error) {
      setFailure(errorText(error))
    } finally {
      setBusy(false)
    }
  }

  if (!ownsLibrary) {
    return <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">此账号无权访问。</div>
  }

  return (
    <section className="mx-auto w-full min-w-0 max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <header className="border-b border-border pb-4">
        <Button variant="ghost" className="mb-1 min-h-11 px-0 md:hidden" asChild>
          <Link to="/m/me"><ArrowLeft aria-hidden="true" />返回我的</Link>
        </Button>
        <h1 className="font-serif text-2xl tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isPrivate ? '旧手机照片和视频。预览与下载需要登录。' : '浏览 static.kskbl.com.cn 上的公开文件。'}
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="文件夹路径" className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
          <Button variant="ghost" size="sm" disabled={busy || !path} onClick={() => openFolder('')}>根目录</Button>
          {trail.map((name, index) => (
            <span key={index} className="flex min-w-0 items-center gap-1">
              <span aria-hidden="true" className="text-muted-foreground">/</span>
              <Button variant="ghost" size="sm" disabled={busy || index === trail.length - 1}
                onClick={() => openFolder(trail.slice(0, index + 1).join('/'))}>{name}</Button>
            </span>
          ))}
        </nav>
        <form className="flex w-full gap-2 sm:w-auto" onSubmit={(event) => {
          event.preventDefault()
          setAppliedQuery(query.trim())
          setPage(1)
        }}>
          <Input value={query} maxLength={100} onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="搜索当前文件夹" aria-label="搜索当前文件夹" />
          <Button type="submit" variant="outline" disabled={busy}>搜索</Button>
        </form>
      </div>

      {canUpload && (
        <div className="space-y-3 rounded-md border border-dashed border-border px-4 py-3"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); void upload(Array.from(event.dataTransfer.files)) }}>
          <div className="flex flex-wrap items-center gap-2">
            <Input ref={fileInput} type="file" multiple accept={accepted} className="hidden"
              onChange={(event) => void upload(Array.from(event.currentTarget.files ?? []))} />
            <Button size="sm" className="min-h-11 sm:min-h-8" disabled={busy} onClick={() => fileInput.current?.click()}><Upload aria-hidden="true" />上传文件</Button>
            <Button size="sm" className="min-h-11 sm:min-h-8" variant="outline" disabled={busy} onClick={() => setCreateOpen((current) => !current)}><FolderPlus aria-hidden="true" />新建文件夹</Button>
            <p className="w-full text-xs text-muted-foreground">单文件最多 48 MB。上传到这里的文件有公网地址。</p>
          </div>
          {createOpen && (
            <form onSubmit={(event) => void newFolder(event)} className="flex flex-wrap gap-2">
              <Input name="name" required maxLength={80} aria-label="文件夹名称" placeholder="文件夹名称" className="w-full sm:w-52" />
              <Button type="submit" size="sm" disabled={busy}>创建</Button>
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setCreateOpen(false)}>取消</Button>
            </form>
          )}
        </div>
      )}

      {!isPrivate && !canUpload && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>已有站点目录可浏览。新文件上传到 assets。</span>
          <Button variant="link" size="sm" disabled={busy} onClick={() => openFolder('assets')}>前往上传目录</Button>
        </div>
      )}
      {status && <p role="status" className="break-words text-sm text-muted-foreground">{status}</p>}
      {copiedLink && <Input value={copiedLink} readOnly aria-label="公网链接" onFocus={(event) => event.currentTarget.select()} />}
      {failure && <p role="alert" className="whitespace-pre-line break-words text-sm text-destructive">{failure}</p>}

      {listing.isPending && <p role="status" className="text-sm text-muted-foreground">正在读取文件夹…</p>}
      {listing.isError && (
        <div className="flex items-center gap-2">
          <p role="alert" className="text-sm text-destructive">{errorText(listing.error)}</p>
          <Button size="sm" variant="outline" onClick={() => void listing.refetch()}>重试</Button>
        </div>
      )}
      {listing.data?.items.length === 0 && <p className="rounded-md border border-border p-5 text-sm text-muted-foreground">
        {appliedQuery ? '当前文件夹没有匹配的文件。' : '这个文件夹是空的。'}
      </p>}
      {Boolean(listing.data?.items.length) && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,10rem),1fr))] gap-3">
          {listing.data?.items.map((entry) => {
            const Icon = entry.directory ? Folder : isVideo(entry) ? Film : isImage(entry) ? Image : File
            const canPreview = isImage(entry) || isVideo(entry)
            const open = entry.directory ? () => openFolder(entry.path) : () => openPreview(entry)
            return (
              <li key={entry.path} className="min-w-0 overflow-hidden rounded-md border border-border">
                <button type="button" disabled={busy && entry.directory} onClick={open}
                  className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  aria-label={`${entry.directory ? '打开文件夹' : '查看'} ${entry.name}`}>
                  {isPrivate && isImage(entry) ? (
                    <img src={mediaUrl(entry, true)} loading="lazy" decoding="async" alt="" className="h-full w-full object-contain" />
                  ) : <Icon aria-hidden="true" className="h-7 w-7 text-muted-foreground" />}
                </button>
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-medium" title={entry.name}>{entry.name}</p>
                  <p className="text-xs text-muted-foreground">{entry.bytes === null ? '文件夹' : sizeLabel(entry.bytes)}</p>
                  {!entry.directory && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {canPreview && <Button size="sm" className="min-h-11 sm:min-h-8" variant="ghost" onClick={() => openPreview(entry)}>预览</Button>}
                      <Button size="icon" variant="ghost" className="size-11 sm:size-8" asChild>
                        <a aria-label={`下载 ${entry.name}`} href={mediaUrl(entry)}><Download aria-hidden="true" /></a>
                      </Button>
                      {!isPrivate && <Button size="icon" variant="ghost" className="size-11 sm:size-8"
                        aria-label={`复制 ${entry.name} 的公网链接`} onClick={() => void copyLink(entry)}><Copy aria-hidden="true" /></Button>}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1 || busy} onClick={() => setPage((current) => current - 1)}>上一页</Button>
          <span>{page} / {pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages || busy} onClick={() => setPage((current) => current + 1)}>下一页</Button>
        </div>
      )}

      <Dialog open={Boolean(preview)} onOpenChange={(open) => { if (!open) setPreview(null) }}>
        {preview && (
          <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-3xl" aria-describedby={undefined}>
            <DialogHeader><DialogTitle className="break-all pr-6">{preview.name}</DialogTitle></DialogHeader>
            {isVideo(preview) && <video controls playsInline preload="metadata" className="max-h-[65vh] w-full bg-black"
              src={mediaUrl(preview, true)} onError={() => setPreviewError(true)} />}
            {isImage(preview) && <img className="max-h-[65vh] w-full object-contain" src={mediaUrl(preview, true)}
              alt={preview.name} onError={() => setPreviewError(true)} />}
            {previewError && <p role="alert" className="text-sm text-muted-foreground">预览失败，可以下载原文件查看。</p>}
            <div><Button variant="outline" asChild><a href={mediaUrl(preview)}>下载原文件</a></Button></div>
          </DialogContent>
        )}
      </Dialog>
    </section>
  )
}
