import { useState, type MouseEvent } from 'react'
import { ChevronRight, Copy, Download, File, Film, Folder, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface Entry {
  name: string
  path: string
  directory: boolean
  mime: string | null
  bytes: number | null
}

const thumbnailTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
const sizeFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 })
export const isVideo = (entry: Entry) => entry.mime?.startsWith('video/')
export const isImage = (entry: Entry) => entry.mime?.startsWith('image/')
export const canPreview = (entry: Entry) => isImage(entry) || isVideo(entry)

export function sizeLabel(bytes: number) {
  if (bytes >= 1024 ** 2) return `${sizeFormat.format(bytes / 1024 ** 2)} MB`
  if (bytes >= 1024) return `${sizeFormat.format(bytes / 1024)} KB`
  return `${bytes} B`
}

function MediaCover({ src, entry }: { src?: string; entry: Entry }) {
  const [failed, setFailed] = useState(false)
  const Icon = isVideo(entry) ? Film : isImage(entry) ? ImageIcon : File
  if (!src || failed) return <Icon aria-hidden="true" className="size-7 text-muted-foreground" />
  return (
    <img
      src={src}
      loading="lazy"
      decoding="async"
      alt=""
      className="size-full object-cover"
      onError={() => setFailed(true)}
    />
  )
}

interface FileEntriesProps {
  entries: Entry[]
  gallery: boolean
  busy: boolean
  mediaUrl: (entry: Entry) => string
  thumbnailUrl: (entry: Entry) => string
  onOpenFolder: (path: string) => void
  onPreview: (entry: Entry, trigger: HTMLElement) => void
  onCopy: (entry: Entry) => void
}

export function FileEntries({
  entries,
  gallery,
  busy,
  mediaUrl,
  thumbnailUrl,
  onOpenFolder,
  onPreview,
  onCopy,
}: FileEntriesProps) {
  function download(entry: Entry) {
    return (
      <Button variant="ghost" size="icon-sm" className="size-11 sm:size-9" asChild>
        <a href={mediaUrl(entry)} aria-label={`下载 ${entry.name}`} title="下载">
          <Download aria-hidden="true" />
        </a>
      </Button>
    )
  }

  const rows = gallery ? entries.filter((entry) => entry.directory) : entries
  const tiles = gallery ? entries.filter((entry) => !entry.directory) : []
  const rowAction =
    'flex min-h-11 w-full min-w-0 items-center gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50'

  return (
    <div className="space-y-4">
      {rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          {!gallery && (
            <div
              aria-hidden="true"
              className="hidden grid-cols-[minmax(0,1fr)_6rem_5rem] items-center gap-4 border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground sm:grid"
            >
              <span>名称</span>
              <span>大小</span>
              <span className="text-center">操作</span>
            </div>
          )}
          <ul aria-label={gallery ? '文件夹' : '文件列表'} className="divide-y divide-border">
            {rows.map((entry) => {
              const Icon = entry.directory
                ? Folder
                : isVideo(entry)
                  ? Film
                  : isImage(entry)
                    ? ImageIcon
                    : File
              const metadata = entry.bytes === null ? '文件夹' : sizeLabel(entry.bytes)
              const details = (
                <>
                  <Icon
                    aria-hidden="true"
                    className={`size-[18px] shrink-0 ${entry.directory ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium" title={entry.name}>
                      {entry.name}
                    </span>
                    {!gallery && (
                      <span className="block text-xs tabular-nums text-muted-foreground sm:hidden">
                        {metadata}
                      </span>
                    )}
                  </span>
                  {gallery && (
                    <ChevronRight
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                  )}
                </>
              )
              const open = (event: MouseEvent<HTMLButtonElement>) =>
                entry.directory ? onOpenFolder(entry.path) : onPreview(entry, event.currentTarget)

              return (
                <li
                  key={entry.path}
                  className={`items-center px-2.5 hover:bg-muted/40 sm:px-4 ${
                    gallery
                      ? ''
                      : 'grid min-h-14 grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_5rem] sm:gap-4'
                  }`}
                >
                  {entry.directory || canPreview(entry) ? (
                    <button
                      type="button"
                      className={rowAction}
                      aria-label={`${entry.directory ? '打开文件夹' : '预览'} ${entry.name}`}
                      disabled={busy && entry.directory}
                      onClick={open}
                    >
                      {details}
                    </button>
                  ) : (
                    <a
                      className={rowAction}
                      href={mediaUrl(entry)}
                      aria-label={`下载原文件 ${entry.name}`}
                    >
                      {details}
                    </a>
                  )}
                  {!gallery && (
                    <>
                      <span className="hidden text-sm tabular-nums text-muted-foreground sm:block">
                        {metadata}
                      </span>
                      <div className="flex justify-end">
                        {!entry.directory && (
                          <>
                            {download(entry)}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="size-11 sm:size-9"
                              aria-label={`复制 ${entry.name} 的公网链接`}
                              title="复制公网链接"
                              onClick={() => onCopy(entry)}
                            >
                              <Copy aria-hidden="true" />
                            </Button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {tiles.length > 0 && (
        <ul
          aria-label="图库文件"
          className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5"
        >
          {tiles.map((entry) => {
            const src =
              entry.mime && thumbnailTypes.has(entry.mime) ? thumbnailUrl(entry) : undefined
            const coverClass =
              'flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring'
            const cover = <MediaCover src={src} entry={entry} />
            return (
              <li
                key={entry.path}
                className="min-w-0 overflow-hidden rounded-xl border border-border"
              >
                {canPreview(entry) ? (
                  <button
                    type="button"
                    className={coverClass}
                    aria-label={`预览 ${entry.name}`}
                    onClick={(event) => onPreview(entry, event.currentTarget)}
                  >
                    {cover}
                  </button>
                ) : (
                  <a
                    className={coverClass}
                    href={mediaUrl(entry)}
                    aria-label={`下载原文件 ${entry.name}`}
                  >
                    {cover}
                  </a>
                )}
                <div className="flex min-w-0 items-center justify-between gap-1 px-2 sm:gap-2 sm:px-3">
                  <div className="min-w-0 py-1.5">
                    <p className="truncate text-sm font-medium" title={entry.name}>
                      {entry.name}
                    </p>
                    {entry.bytes !== null && (
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {sizeLabel(entry.bytes)}
                      </p>
                    )}
                  </div>
                  {download(entry)}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
