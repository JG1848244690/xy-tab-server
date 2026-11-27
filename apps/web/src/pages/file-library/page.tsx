import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Folder,
  FolderPlus,
  Search,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { env } from '@/lib/env'
import { request } from '@/lib/request'
import { useAuthStore } from '@/store/auth-store'
import { canPreview, FileEntries, isImage, isVideo, sizeLabel, type Entry } from './file-entries'

type Library = 'static' | 'private'
type Location = { source: Library | 'private-uploads'; path: string }
type Listing = { items: Entry[]; total: number; pageSize: number }
type Transfer = { name: string; index: number; count: number; loaded: number; size: number }

const publicHost = 'https://static.kskbl.com.cn'
const mutationHeader = { 'X-Hls-File-Library': '1' }
const accepted = '.jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.mp4,.mov,.webm,.pdf,.zip'
const uploadLimit = 48 * 1024 * 1024
const apiBase = env.apiBase.replace(/\/$/, '')
const endpoint = (source: Location['source']) => `/file-library/${source}`
const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files')

function errorText(error: unknown) {
  const message = isAxiosError<{ message?: string }>(error)
    ? error.response?.data?.message
    : undefined
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
  const listingTop = useRef<HTMLDivElement>(null)
  const previewTrigger = useRef<HTMLElement | null>(null)
  const dragDepth = useRef(0)
  const mutationInFlight = useRef(false)
  const [location, setLocation] = useState<Location>(() => ({
    source: library,
    path: library === 'static' && searchParams.get('folder') === 'assets' ? 'assets' : '',
  }))
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [preview, setPreview] = useState<Entry | null>(null)
  const [previewError, setPreviewError] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [transfer, setTransfer] = useState<Transfer | null>(null)
  const [status, setStatus] = useState('')
  const [failure, setFailure] = useState('')
  const [copiedLink, setCopiedLink] = useState('')

  const { source, path } = location
  const isPrivate = library === 'private'
  const title = isPrivate ? '私人图库' : '资源管理'
  const isPrivateUploads = source === 'private-uploads'
  const canCreateHere =
    isPrivateUploads || (source === 'static' && (path === 'assets' || path.startsWith('assets/')))
  const uploadTarget: Location = canCreateHere
    ? location
    : isPrivate
      ? { source: 'private-uploads', path: '' }
      : { source: 'static', path: 'assets' }
  const uploadLabel = isPrivate
    ? uploadTarget.path
      ? '我的上传 / ' + uploadTarget.path
      : '我的上传'
    : uploadTarget.path
  const trail = path ? path.split('/') : []
  const mediaBase = apiBase + endpoint(source)
  const listing = useQuery({
    queryKey: ['file-library', userId, source, path, appliedQuery, page],
    enabled: ownsLibrary,
    retry: false,
    queryFn: async ({ signal }) =>
      (
        await request.get<Listing>(endpoint(source) + '/list', {
          params: { path, q: appliedQuery, page },
          signal,
        })
      ).data,
  })
  const entries = listing.data?.items ?? []
  const previews = entries.filter(canPreview)
  const previewIndex = preview ? previews.findIndex((entry) => entry.path === preview.path) : -1
  const pages = listing.data
    ? Math.max(1, Math.ceil(listing.data.total / listing.data.pageSize))
    : 1

  function mediaUrl(entry: Entry, inline = false) {
    return `${mediaBase}/file?${new URLSearchParams({ path: entry.path, ...(inline ? { preview: '1' } : {}) })}`
  }

  function clearSearch() {
    setQuery('')
    setAppliedQuery('')
    setPage(1)
  }

  function browse(next: Location) {
    setLocation(next)
    clearSearch()
    setCreateOpen(false)
    setFailure('')
    setStatus('')
    setCopiedLink('')
  }

  function openFolder(folder: string) {
    if (!mutationInFlight.current) browse({ source, path: folder })
  }

  function openPreview(entry: Entry, trigger?: HTMLElement) {
    if (trigger) previewTrigger.current = trigger
    setPreviewError(false)
    setPreview(entry)
  }

  function stepPreview(step: number) {
    const next = previews[previewIndex + step]
    if (previewIndex >= 0 && next) openPreview(next)
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

  async function upload(files: File[], containsFolder = false) {
    if (mutationInFlight.current) return
    if (containsFolder) {
      setStatus('')
      setFailure('请打开文件夹并拖入其中的文件。')
      return
    }
    if (!files.length) return
    mutationInFlight.current = true
    setBusy(true)
    browse(uploadTarget)
    const failed: string[] = []
    let completed = 0
    try {
      for (const [index, file] of files.entries()) {
        if (file.size > uploadLimit) {
          failed.push(`${file.name}：单个文件最多 48 MB。`)
          continue
        }
        const current: Transfer = {
          name: file.name,
          index: index + 1,
          count: files.length,
          loaded: 0,
          size: file.size,
        }
        setTransfer(current)
        try {
          await request.post(endpoint(uploadTarget.source) + '/upload', file, {
            params: { path: uploadTarget.path, name: file.name },
            headers: { ...mutationHeader, 'Content-Type': 'application/octet-stream' },
            onUploadProgress: ({ loaded }) =>
              setTransfer({ ...current, loaded: Math.min(loaded, file.size) }),
          })
          completed++
        } catch (error) {
          failed.push(`${file.name}：${errorText(error)}`)
        }
      }
      setTransfer(null)
      if (completed) {
        await queryClient.invalidateQueries({
          queryKey: ['file-library', userId, uploadTarget.source],
        })
        setStatus(`已上传 ${completed} 个文件。`)
      }
      if (failed.length) setFailure(failed.join('\n'))
    } finally {
      mutationInFlight.current = false
      setBusy(false)
      setTransfer(null)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  function handleDrop(event: DragEvent) {
    if (!hasFiles(event)) return
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    if (preview) return
    const containsFolder = Array.from(event.dataTransfer.items).some(
      (item) => item.webkitGetAsEntry?.()?.isDirectory
    )
    void upload(Array.from(event.dataTransfer.files), containsFolder)
  }

  async function newFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutationInFlight.current || !canCreateHere) return
    const name = String(new FormData(event.currentTarget).get('name') ?? '').trim()
    mutationInFlight.current = true
    setBusy(true)
    setFailure('')
    setStatus('')
    try {
      await request.post(endpoint(source) + '/folder', { path, name }, { headers: mutationHeader })
      clearSearch()
      await queryClient.invalidateQueries({ queryKey: ['file-library', userId, source, path] })
      setCreateOpen(false)
      setStatus('文件夹已创建。')
    } catch (error) {
      setFailure(errorText(error))
    } finally {
      mutationInFlight.current = false
      setBusy(false)
    }
  }

  function changePage(next: number) {
    setPage(next)
    listingTop.current?.scrollIntoView({ block: 'start' })
  }

  if (!ownsLibrary) {
    return (
      <div className="mx-auto max-w-6xl py-8 text-sm text-muted-foreground">此账号无权访问。</div>
    )
  }

  return (
    <section
      aria-labelledby="file-library-title"
      className="mx-auto w-full min-w-0 max-w-6xl space-y-5 py-4 sm:px-4 sm:py-6"
      onDragEnter={(event) => {
        if (!hasFiles(event)) return
        event.preventDefault()
        dragDepth.current++
        if (!busy && !preview) setDragging(true)
      }}
      onDragOver={(event) => {
        if (!hasFiles(event)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = busy || preview ? 'none' : 'copy'
      }}
      onDragLeave={(event) => {
        if (!hasFiles(event)) return
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (!dragDepth.current) setDragging(false)
      }}
      onDrop={handleDrop}
    >
      {dragging && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-3 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-background/95 px-6 sm:inset-6"
        >
          <div className="max-w-xl space-y-2 text-center">
            <Upload className="mx-auto size-8 text-primary" />
            <p className="text-xl font-medium">松开以上传文件</p>
            <p className="break-all text-sm text-muted-foreground">
              {uploadLabel}
              {!isPrivate && ' · 公开'}
            </p>
          </div>
        </div>
      )}

      <header className="space-y-2.5">
        <Button variant="ghost" className="-ml-2 min-h-11 px-2 md:hidden" asChild>
          <Link to="/m/me">
            <ArrowLeft aria-hidden="true" />
            返回我的
          </Link>
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 id="file-library-title" className="font-serif text-3xl tracking-tight">
              {title}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {isPrivate
                ? '浏览旧手机备份，或上传文件在设备间传输。'
                : '浏览公开资源，上传文件并复制分享链接。'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={accepted}
              className="hidden"
              aria-label="选择要上传的文件"
              onChange={(event) => void upload(Array.from(event.currentTarget.files ?? []))}
            />
            <Button
              type="button"
              className="min-h-11 sm:min-h-9"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              <Upload aria-hidden="true" />
              上传文件
            </Button>
            {canCreateHere && (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 sm:min-h-9"
                disabled={busy}
                aria-expanded={createOpen}
                onClick={() => setCreateOpen((current) => !current)}
              >
                <FolderPlus aria-hidden="true" />
                新建文件夹
              </Button>
            )}
          </div>
        </div>
        <p className="break-all text-xs leading-relaxed text-muted-foreground">
          上传至 {uploadLabel}
          {!isPrivate && '（文件公开）'} · 单文件最多 48 MB
          <span className="hidden sm:inline"> · 可将文件拖入页面</span>
        </p>
      </header>

      <div className="space-y-3 border-y border-border py-3">
        {isPrivate && (
          <div
            className="inline-flex gap-1 rounded-lg bg-muted/60 p-1"
            role="group"
            aria-label="图库位置"
          >
            <Button
              type="button"
              variant={isPrivateUploads ? 'ghost' : 'outline'}
              size="sm"
              className="min-h-11 sm:min-h-8"
              disabled={busy}
              aria-pressed={!isPrivateUploads}
              onClick={() => browse({ source: 'private', path: '' })}
            >
              手机备份
            </Button>
            <Button
              type="button"
              variant={isPrivateUploads ? 'outline' : 'ghost'}
              size="sm"
              className="min-h-11 sm:min-h-8"
              disabled={busy}
              aria-pressed={isPrivateUploads}
              onClick={() => browse({ source: 'private-uploads', path: '' })}
            >
              我的上传
            </Button>
          </div>
        )}
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <nav
            aria-label="文件夹路径"
            className="flex min-w-0 flex-wrap items-center gap-x-1 text-sm"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-10 sm:min-h-8"
              disabled={busy || !path}
              aria-current={path ? undefined : 'location'}
              onClick={() => openFolder('')}
            >
              根目录
            </Button>
            {trail.map((name, index) => (
              <span key={index} className="flex min-w-0 max-w-full items-center gap-1">
                <ChevronRight
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-10 min-w-0 shrink whitespace-normal text-left sm:min-h-8"
                  disabled={busy || index === trail.length - 1}
                  aria-current={index === trail.length - 1 ? 'location' : undefined}
                  onClick={() => openFolder(trail.slice(0, index + 1).join('/'))}
                >
                  <span className="truncate" title={name}>
                    {name}
                  </span>
                </Button>
              </span>
            ))}
            {!isPrivate && !canCreateHere && (
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11 text-primary sm:min-h-8"
                disabled={busy}
                onClick={() => browse(uploadTarget)}
              >
                <Folder aria-hidden="true" />
                打开上传目录
              </Button>
            )}
          </nav>
          <form
            className="flex min-w-0 gap-2 sm:w-80 sm:shrink-0"
            onSubmit={(event) => {
              event.preventDefault()
              setAppliedQuery(query.trim())
              setPage(1)
            }}
          >
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                maxLength={100}
                disabled={busy}
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="搜索当前文件夹"
                aria-label="搜索当前文件夹"
                className="h-11 pr-10 pl-9 sm:h-9"
              />
              {(query || appliedQuery) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-0 top-1/2 size-10 -translate-y-1/2 sm:size-8"
                  aria-label="清除搜索"
                  disabled={busy}
                  onClick={clearSearch}
                >
                  <X aria-hidden="true" />
                </Button>
              )}
            </div>
            <Button type="submit" variant="outline" className="min-h-11 sm:min-h-9" disabled={busy}>
              搜索
            </Button>
          </form>
        </div>
      </div>

      {createOpen && (
        <form
          onSubmit={(event) => void newFolder(event)}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3"
        >
          <Input
            name="name"
            required
            maxLength={80}
            autoFocus
            aria-label="文件夹名称"
            placeholder="文件夹名称"
            className="h-11 w-full sm:h-9 sm:w-64"
          />
          <Button type="submit" className="min-h-11 sm:min-h-9" disabled={busy}>
            创建
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 sm:min-h-9"
            disabled={busy}
            onClick={() => setCreateOpen(false)}
          >
            取消
          </Button>
        </form>
      )}

      {transfer && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
            <p role="status" className="min-w-0 break-all">
              正在上传 {transfer.name}（{transfer.index}/{transfer.count}）
            </p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {sizeLabel(transfer.loaded)} / {sizeLabel(transfer.size)}
            </p>
          </div>
          <progress
            aria-label="当前文件上传进度"
            className="block h-2 w-full accent-primary"
            max={Math.max(1, transfer.size)}
            value={transfer.loaded}
          />
        </div>
      )}
      {status && (
        <p role="status" className="break-words text-sm text-muted-foreground">
          {status}
        </p>
      )}
      {copiedLink && (
        <Input
          value={copiedLink}
          readOnly
          aria-label="公网链接"
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
      {failure && (
        <p role="alert" className="whitespace-pre-line break-words text-sm text-destructive">
          {failure}
        </p>
      )}

      <div ref={listingTop} className="scroll-mt-4 space-y-3">
        {listing.isPending && (
          <p role="status" className="py-8 text-center text-sm text-muted-foreground">
            正在读取文件夹…
          </p>
        )}
        {listing.isError && (
          <div className="flex items-center gap-3 rounded-lg border border-border p-4">
            <p role="alert" className="text-sm text-destructive">
              {errorText(listing.error)}
            </p>
            <Button size="sm" variant="outline" onClick={() => void listing.refetch()}>
              重试
            </Button>
          </div>
        )}
        {listing.data && (
          <>
            <div className="flex items-center justify-between gap-2 text-sm">
              <p className="min-w-0 truncate text-muted-foreground">
                {appliedQuery ? `“${appliedQuery}”的搜索结果` : '文件与文件夹'}
              </p>
              <p className="shrink-0 tabular-nums text-muted-foreground">{listing.data.total} 项</p>
            </div>
            {entries.length ? (
              <FileEntries
                entries={entries}
                gallery={isPrivate}
                busy={busy}
                mediaUrl={mediaUrl}
                thumbnailUrl={(entry) =>
                  `${mediaBase}/thumbnail?${new URLSearchParams({ path: entry.path })}`
                }
                onOpenFolder={openFolder}
                onPreview={openPreview}
                onCopy={(entry) => void copyLink(entry)}
              />
            ) : (
              <div className="space-y-2 rounded-xl border border-border px-4 py-10 text-center">
                <Folder aria-hidden="true" className="mx-auto size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {appliedQuery ? '找不到匹配的文件。' : '这个文件夹是空的。'}
                </p>
                {appliedQuery && (
                  <Button type="button" variant="outline" size="sm" onClick={clearSearch}>
                    清除搜索
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {pages > 1 && (
        <nav
          aria-label="文件列表分页"
          className="flex items-center justify-center gap-2 border-t border-border pt-3 text-sm sm:justify-end"
        >
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11 sm:min-h-8"
            disabled={page <= 1 || busy}
            onClick={() => changePage(page - 1)}
          >
            <ChevronLeft aria-hidden="true" />
            上一页
          </Button>
          <span className="min-w-16 text-center tabular-nums text-muted-foreground">
            {page} / {pages}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11 sm:min-h-8"
            disabled={page >= pages || busy}
            onClick={() => changePage(page + 1)}
          >
            下一页
            <ChevronRight aria-hidden="true" />
          </Button>
        </nav>
      )}

      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) setPreview(null)
        }}
      >
        {preview && (
          <DialogContent
            className="max-h-[90dvh] overflow-auto p-4 sm:max-w-4xl sm:p-5"
            aria-describedby={undefined}
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              previewTrigger.current?.focus()
            }}
            onKeyDown={(event) => {
              if (
                event.target instanceof HTMLVideoElement ||
                event.altKey ||
                event.ctrlKey ||
                event.metaKey
              )
                return
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault()
                stepPreview(event.key === 'ArrowLeft' ? -1 : 1)
              }
            }}
          >
            <DialogHeader>
              <DialogTitle className="break-all pr-8 text-left leading-snug">
                {preview.name}
              </DialogTitle>
            </DialogHeader>
            <div className="grid min-h-24 place-items-center overflow-hidden rounded-lg bg-muted/60">
              {previewError ? (
                <p role="alert" className="px-4 py-8 text-center text-sm text-muted-foreground">
                  预览失败，可以下载原文件查看。
                </p>
              ) : isVideo(preview) ? (
                <video
                  key={preview.path}
                  controls
                  playsInline
                  preload="metadata"
                  className="max-h-[66dvh] w-full bg-black"
                  src={mediaUrl(preview, true)}
                  onError={() => setPreviewError(true)}
                />
              ) : (
                isImage(preview) && (
                  <img
                    key={preview.path}
                    className="max-h-[66dvh] w-full object-contain"
                    src={mediaUrl(preview, true)}
                    alt={preview.name}
                    onError={() => setPreviewError(true)}
                  />
                )
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="outline" className="min-h-11 sm:min-h-9" asChild>
                <a href={mediaUrl(preview)}>
                  <Download aria-hidden="true" />
                  下载原文件
                </a>
              </Button>
              {previews.length > 1 && previewIndex >= 0 && (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-11 sm:size-9"
                    aria-label="上一个文件"
                    disabled={previewIndex === 0}
                    onClick={() => stepPreview(-1)}
                  >
                    <ChevronLeft aria-hidden="true" />
                  </Button>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {previewIndex + 1} / {previews.length}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-11 sm:size-9"
                    aria-label="下一个文件"
                    disabled={previewIndex === previews.length - 1}
                    onClick={() => stepPreview(1)}
                  >
                    <ChevronRight aria-hidden="true" />
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </section>
  )
}
