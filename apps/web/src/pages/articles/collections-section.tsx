import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Layers, ListOrdered, Pencil, Plus, Trash2 } from 'lucide-react'
import {
    collectionsApi,
    type Collection,
    type CollectionStatus,
} from '@/services/collections-api'
import { CollectionDialog } from './collection-dialog'
import { CollectionArticlesDialog } from './collection-articles-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'

/**
 * 「合集」区块:挂在文章页内部,不再单独占菜单或 tab。
 * 文章是扁平列表,合集是有序容器,两者在同一个页面里分区展示。
 */
export function CollectionsSection() {
    const queryClient = useQueryClient()
    const [open, setOpen] = useState(false)
    const [editing, setEditing] = useState<Collection | null>(null)
    const [managing, setManaging] = useState<Collection | null>(null)

    const { data, isLoading } = useQuery({
        queryKey: ['collections', 'section'],
        queryFn: () => collectionsApi.list({ page: 1, size: 50 }),
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

    return (
        <section className="rounded-lg border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5">
                <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold">合集</h2>
                    <span className="text-xs text-muted-foreground">
                        把同主题的文章串成有序系列
                    </span>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        setEditing(null)
                        setOpen(true)
                    }}
                >
                    <Plus className="mr-1 h-4 w-4" />
                    新建合集
                </Button>
            </div>

            {isLoading ? (
                <div className="p-3">
                    <Skeleton className="h-12 w-full" />
                </div>
            ) : rows.length ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>合集</TableHead>
                            <TableHead className="w-20">文章</TableHead>
                            <TableHead className="w-20">状态</TableHead>
                            <TableHead className="w-44 text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>
                                    <div className="font-medium">{item.title}</div>
                                    <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                                        /collection/{item.slug}
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {item.articleCount} 篇
                                </TableCell>
                                <TableCell>
                                    <span
                                        className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                                            item.status === 'approved'
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                                : 'bg-muted text-muted-foreground'
                                        }`}
                                    >
                                        {(item.status as CollectionStatus) === 'approved'
                                            ? '已发布'
                                            : '草稿'}
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
                                            disabled={togglePublish.isPending}
                                            onClick={() => togglePublish.mutate(item)}
                                        >
                                            {item.status === 'approved' ? '下线' : '发布'}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive hover:text-destructive"
                                            disabled={remove.isPending}
                                            onClick={() => {
                                                if (
                                                    window.confirm(
                                                        `删除合集《${item.title}》?文章本身不会被删除。`,
                                                    )
                                                )
                                                    remove.mutate(item.id)
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    还没有合集。建一个,把同主题的文章排进去。
                </p>
            )}

            <CollectionDialog open={open} onOpenChange={setOpen} collection={editing} />
            <CollectionArticlesDialog
                open={!!managing}
                onOpenChange={(v) => {
                    if (!v) setManaging(null)
                }}
                collection={managing}
            />
        </section>
    )
}
