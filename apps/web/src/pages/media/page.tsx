import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, ImagePlus, Loader2, ShieldCheck, Trash2, Wand2 } from 'lucide-react'
import { mediaApi, type MediaAsset } from '@/services/media-api'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * 图库(仅 admin)
 *
 * 所有通过后台上传的图片都在这里统一管理:
 *  - 上传落 static 子域,DB 记元信息;
 *  - 「被引用 N 处」由正文实时扫描得出,0 = 未使用,可以安全删除;
 *  - 支持一键清理未使用图片。
 * 编辑器里粘贴/拖拽图片也会走同一套上传(services/media-api.ts)。
 */

const PAGE_SIZE = 24

function fmtBytes(n: number): string {
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
    return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function AssetCard({
    asset,
    onDelete,
    deleting,
}: {
    asset: MediaAsset
    onDelete: () => void
    deleting: boolean
}) {
    const [copied, setCopied] = useState(false)
    const [broken, setBroken] = useState(false)

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(asset.url)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
        } catch {
            window.prompt('复制图片链接', asset.url)
        }
    }

    const used = asset.usage > 0

    return (
        <div className="overflow-hidden rounded-lg border bg-card">
            <a
                href={asset.url}
                target="_blank"
                rel="noreferrer"
                className="flex aspect-[4/3] items-center justify-center bg-muted"
                title="查看原图"
            >
                {broken ? (
                    <span className="px-2 text-center text-[11px] text-muted-foreground">
                        文件缺失
                    </span>
                ) : (
                    <img
                        src={asset.url}
                        alt={asset.path}
                        loading="lazy"
                        className="h-full w-full object-cover"
                        onError={() => setBroken(true)}
                    />
                )}
            </a>
            <div className="space-y-1.5 p-2.5">
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span className="font-mono">{fmtBytes(asset.bytes)}</span>
                    <span>{new Date(asset.createdAt).toLocaleDateString('zh-CN')}</span>
                </div>
                <div className="flex items-center justify-between gap-1">
                    <span
                        className={cn(
                            'shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] leading-none',
                            used
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground',
                        )}
                        title={used ? '被正文引用,删除前请先去掉引用' : '未被引用,可安全删除'}
                    >
                        {used ? `引用 ${asset.usage}` : '未使用'}
                    </span>
                    <div className="flex items-center">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title={copied ? '已复制' : '复制链接'}
                            onClick={copy}
                        >
                            {copied ? (
                                <Check className="h-3.5 w-3.5 text-primary" />
                            ) : (
                                <Copy className="h-3.5 w-3.5" />
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            disabled={used || deleting}
                            title={used ? '图片仍被引用,先删除正文里的引用' : '删除图片'}
                            onClick={() => {
                                if (window.confirm('确定删除这张图片?文件会一起删除。')) onDelete()
                            }}
                        >
                            {deleting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function MediaPage() {
    const role = useAuthStore((s) => s.user?.role)
    const queryClient = useQueryClient()
    const [page, setPage] = useState(1)
    const [unusedOnly, setUnusedOnly] = useState(false)
    const [tip, setTip] = useState<string | null>(null)
    const fileInput = useRef<HTMLInputElement>(null)

    const { data, isLoading } = useQuery({
        queryKey: ['media', page, unusedOnly],
        queryFn: () => mediaApi.list({ page, size: PAGE_SIZE, unused: unusedOnly }),
        staleTime: 0,
    })

    const invalidate = () => {
        void queryClient.invalidateQueries({ queryKey: ['media'] })
    }

    const upload = useMutation({
        mutationFn: async (files: File[]) => {
            const results: MediaAsset[] = []
            for (const f of files) results.push(await mediaApi.upload(f))
            return results
        },
        onSuccess: (assets) => {
            setTip(`已上传 ${assets.length} 张图片`)
            invalidate()
        },
        onError: (err) => setTip(err instanceof Error ? err.message : '上传失败'),
    })

    const remove = useMutation({
        mutationFn: (id: string) => mediaApi.remove(id),
        onSuccess: () => invalidate(),
        onError: (err) => setTip(err instanceof Error ? err.message : '删除失败'),
    })

    const cleanup = useMutation({
        mutationFn: () => mediaApi.cleanup(),
        onSuccess: (res) => {
            setTip(res.deleted ? `已清理 ${res.deleted} 张未使用图片` : '没有可清理的图片')
            invalidate()
        },
        onError: (err) => setTip(err instanceof Error ? err.message : '清理失败'),
    })

    if (role !== 'admin') {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="text-lg">需要管理员权限</p>
                    <p className="mt-1 text-sm text-muted-foreground">图库仅对 admin 开放。</p>
                </div>
            </div>
        )
    }

    const counts = data?.counts
    const total = data?.total ?? 0
    const totalPages = Math.max(1, Math.ceil(total / (data?.size ?? PAGE_SIZE)))
    const assets = data?.data ?? []

    const pickFiles = () => fileInput.current?.click()

    return (
        <div className="flex h-full flex-col overflow-hidden">
            <div className="border-b px-6 pb-4 pt-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-bold">图库</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            题目/文章里的图片统一存这里。被引用的图片不能删;未使用的可以一键清理。
                        </p>
                    </div>
                    <div className="flex flex-none items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!counts?.unused || cleanup.isPending}
                            onClick={() => {
                                if (
                                    window.confirm(
                                        `确定清理 ${counts?.unused ?? 0} 张未被引用的图片?文件会一起删除。`,
                                    )
                                )
                                    cleanup.mutate()
                            }}
                        >
                            {cleanup.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Wand2 className="h-4 w-4" />
                            )}
                            清理未使用
                            {counts?.unused ? (
                                <span className="ml-1 font-mono text-xs">{counts.unused}</span>
                            ) : null}
                        </Button>
                        <Button size="sm" disabled={upload.isPending} onClick={pickFiles}>
                            {upload.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <ImagePlus className="h-4 w-4" />
                            )}
                            上传图片
                        </Button>
                        <input
                            ref={fileInput}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                                const files = Array.from(e.target.files ?? [])
                                e.target.value = ''
                                if (files.length) upload.mutate(files)
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <Button
                        variant={unusedOnly ? 'outline' : 'default'}
                        size="sm"
                        onClick={() => {
                            setUnusedOnly(false)
                            setPage(1)
                        }}
                    >
                        全部
                        <span className="ml-1.5 rounded-full bg-primary-foreground/20 px-1.5 py-0.5 font-mono text-[10px] leading-none">
                            {counts?.all ?? 0}
                        </span>
                    </Button>
                    <Button
                        variant={unusedOnly ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                            setUnusedOnly(true)
                            setPage(1)
                        }}
                    >
                        未使用
                        <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] leading-none">
                            {counts?.unused ?? 0}
                        </span>
                    </Button>
                    <span className="text-xs text-muted-foreground">
                        支持 png / jpeg / webp / gif,单张 ≤ 5MB;编辑器里可直接粘贴或拖拽图片
                    </span>
                </div>

                {tip ? <p className="mb-3 text-xs text-primary">{tip}</p> : null}

                {isLoading ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={i} className="h-52 w-full" />
                        ))}
                    </div>
                ) : assets.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                        {unusedOnly ? '没有未使用的图片' : '还没有上传过图片'}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                        {assets.map((asset) => (
                            <AssetCard
                                key={asset.id}
                                asset={asset}
                                deleting={remove.isPending && remove.variables === asset.id}
                                onDelete={() => remove.mutate(asset.id)}
                            />
                        ))}
                    </div>
                )}

                {total > 0 && (
                    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                        <span>共 {total} 张</span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                上一页
                            </Button>
                            <span className="font-mono text-xs">
                                {page} / {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= totalPages}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                下一页
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
