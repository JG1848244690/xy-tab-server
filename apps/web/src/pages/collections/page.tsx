import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ListOrdered, Pencil, Plus, Trash2 } from 'lucide-react'
import {
    collectionsApi,
    type Collection,
    type CollectionStatus,
} from '@/services/collections-api'
import { CollectionDialog } from './collection-dialog'
import { CollectionArticlesDialog } from './collection-articles-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import Select from '@/components/ui/select'

const PAGE_SIZE = 20

const STATUS_LABEL: Record<CollectionStatus, string> = {
    draft: '草稿',
    approved: '已发布',
}

export default function CollectionsPage() {
    const queryClient = useQueryClient()
    const [status, setStatus] = useState<'all' | CollectionStatus>('all')
    const [q, setQ] = useState('')
    const [page, setPage] = useState(1)
    const [open, setOpen] = useState(false)
    const [editing, setEditing] = useState<Collection | null>(null)
    const [managing, setManaging] = useState<Collection | null>(null)

    const { data, isLoading } = useQuery({
        queryKey: ['collections', status, q, page],
        queryFn: () =>
            collectionsApi.list({
                status: status === 'all' ? undefined : status,
                q: q.trim() || undefined,
                page,
                size: PAGE_SIZE,
            }),
    })

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['collections'] })

    const togglePublish = useMutation({
        mutationFn: (item: Collection) =>
            collectionsApi.update(item.id, {
                status: item.status === 'approved' ? 'draft' : 'approved',
            }),
        onSuccess: invalidate,
    })

    const remove = useMutation({
        mutationFn: (id: string) => collectionsApi.remove(id),
        onSuccess: invalidate,
    })

    const rows = data?.data ?? []
    const total = data?.total ?? 0
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    return (
        <div className="flex h-full flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold">合集</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        把同主题的多篇文章串成有序系列,前台是 /collection/&lt;slug&gt;。
                    </p>
                </div>
                <Button
                    onClick={() => {
                        setEditing(null)
                        setOpen(true)
                    }}
                >
                    <Plus className="mr-1 h-4 w-4" />
                    新建合集
                </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="w-32">
                    <Select
                        value={status}
                        onChange={(v) => {
                            setStatus(v as 'all' | CollectionStatus)
                            setPage(1)
                        }}
                        options={[
                            { label: '全部状态', value: 'all' },
                            { label: '草稿', value: 'draft' },
                            { label: '已发布', value: 'approved' },
                        ]}
                    />
                </div>
                <Input
                    value={q}
                    onChange={(e) => {
                        setQ(e.target.value)
                        setPage(1)
                    }}
                    placeholder="搜索标题"
                    className="max-w-64"
                />
                <span className="ml-auto text-xs text-muted-foreground">共 {total} 个合集</span>
            </div>

            <div className="overflow-hidden rounded-lg border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>合集</TableHead>
                            <TableHead className="w-24">文章数</TableHead>
                            <TableHead className="w-20">排序</TableHead>
                            <TableHead className="w-24">状态</TableHead>
                            <TableHead className="w-52 text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={5}>
                                        <Skeleton className="h-6 w-full" />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : rows.length ? (
                            rows.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <div className="font-medium">{item.title}</div>
                                        <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                                            /collection/{item.slug}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {item.articleCount}
                                    </TableCell>
                                    <TableCell className="font-mono text-sm text-muted-foreground">
                                        {item.sort}
                                    </TableCell>
                                    <TableCell>
                                        <span
                                            className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                                                item.status === 'approved'
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                                    : 'bg-muted text-muted-foreground'
                                            }`}
                                        >
                                            {STATUS_LABEL[item.status]}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                title="管理文章"
                                                onClick={() => setManaging(item)}
                                            >
                                                <ListOrdered className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                title="编辑"
                                                onClick={() => {
                                                    setEditing(item)
                                                    setOpen(true)
                                                }}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => togglePublish.mutate(item)}
                                                disabled={togglePublish.isPending}
                                            >
                                                {item.status === 'approved' ? '下线' : '发布'}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() => {
                                                    if (
                                                        window.confirm(
                                                            `删除合集《${item.title}》?文章本身不会被删除。`,
                                                        )
                                                    )
                                                        remove.mutate(item.id)
                                                }}
                                                disabled={remove.isPending}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={5}
                                    className="py-16 text-center text-sm text-muted-foreground"
                                >
                                    还没有合集,点右上角「新建合集」。
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {totalPages > 1 ? (
                <div className="flex items-center justify-end gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                    >
                        上一页
                    </Button>
                    <span className="text-xs text-muted-foreground">
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
            ) : null}

            <CollectionDialog open={open} onOpenChange={setOpen} collection={editing} />
            <CollectionArticlesDialog
                open={!!managing}
                onOpenChange={(v) => {
                    if (!v) setManaging(null)
                }}
                collection={managing}
            />
        </div>
    )
}
