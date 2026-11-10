import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import { collectionsApi, type Collection, type CollectionArticleRef } from '@/services/collections-api'
import { articlesApi } from '@/services/articles-api'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Select from '@/components/ui/select'

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    collection: Collection | null
}

export function CollectionArticlesDialog({ open, onOpenChange, collection }: Props) {
    const queryClient = useQueryClient()
    const [items, setItems] = useState<CollectionArticleRef[]>([])
    const [pickId, setPickId] = useState('')
    const [q, setQ] = useState('')
    const [error, setError] = useState<string | null>(null)

    const detail = useQuery({
        queryKey: ['collections', 'detail', collection?.id],
        queryFn: () => collectionsApi.get(collection!.id),
        enabled: open && !!collection,
    })

    const articles = useQuery({
        queryKey: ['articles', 'picker', q],
        queryFn: () => articlesApi.list({ q: q.trim() || undefined, size: 50 }),
        enabled: open,
    })

    useEffect(() => {
        if (!open) return
        setError(null)
        setPickId('')
        setQ('')
    }, [open, collection?.id])

    useEffect(() => {
        if (detail.data) setItems(detail.data.articles)
    }, [detail.data])

    const picked = useMemo(() => new Set(items.map((i) => i.id)), [items])

    const options = useMemo(() => {
        const list = (articles.data?.data ?? []).filter((a) => !picked.has(a.id))
        return [
            { label: list.length ? '选择要加入的文章…' : '没有可加入的文章', value: '' },
            ...list.map((a) => ({
                label: `${a.kind === 'own' ? '原创' : '荐文'} · ${a.title}`,
                value: a.id,
            })),
        ]
    }, [articles.data, picked])

    const add = () => {
        const article = (articles.data?.data ?? []).find((a) => a.id === pickId)
        if (!article) return
        setItems((prev) => [
            ...prev,
            {
                id: article.id,
                slug: article.slug,
                title: article.title,
                kind: article.kind,
                status: article.status,
                publishedAt: article.publishedAt,
                sort: prev.length,
            },
        ])
        setPickId('')
    }

    const move = (index: number, delta: number) => {
        setItems((prev) => {
            const next = [...prev]
            const target = index + delta
            if (target < 0 || target >= next.length) return prev
            const [row] = next.splice(index, 1)
            next.splice(target, 0, row!)
            return next
        })
    }

    const removeAt = (index: number) => {
        setItems((prev) => prev.filter((_, i) => i !== index))
    }

    const save = useMutation({
        mutationFn: () => collectionsApi.setArticles(collection!.id, items.map((i) => i.id)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['collections'] })
            onOpenChange(false)
        },
        onError: (err: unknown) => {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                (err as Error)?.message ??
                '保存失败'
            setError(msg)
        },
    })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>管理文章 · {collection?.title}</DialogTitle>
                    <DialogDescription>
                        排序决定前台合集页的阅读顺序,也是「上一篇 / 下一篇」的顺序。
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-3">
                    <div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
                        <Label>加入文章</Label>
                        <div className="flex gap-2">
                            <Input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="搜索标题"
                                className="max-w-48"
                            />
                            <div className="min-w-0 flex-1">
                                <Select value={pickId} onChange={setPickId} options={options} />
                            </div>
                            <Button onClick={add} disabled={!pickId} className="flex-none">
                                <Plus className="mr-1 h-4 w-4" />
                                加入
                            </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            只列出最近 50 篇,搜索可缩小范围。草稿文章也能加入,但前台只显示已发布的。
                        </p>
                    </div>

                    <div className="max-h-[42vh] overflow-y-auto rounded-lg border">
                        {detail.isLoading ? (
                            <p className="p-6 text-center text-sm text-muted-foreground">加载中…</p>
                        ) : items.length ? (
                            items.map((item, index) => (
                                <div
                                    key={item.id}
                                    className="flex items-center gap-3 border-b px-3 py-2 last:border-0"
                                >
                                    <span className="w-6 flex-none font-mono text-xs text-muted-foreground">
                                        {index + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-medium">{item.title}</div>
                                        <div className="font-mono text-[11px] text-muted-foreground">
                                            /article/{item.slug}
                                            {item.status !== 'approved' ? ' · 未发布' : ''}
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={index === 0}
                                        onClick={() => move(index, -1)}
                                    >
                                        <ArrowUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={index === items.length - 1}
                                        onClick={() => move(index, 1)}
                                    >
                                        <ArrowDown className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => removeAt(index)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <p className="p-6 text-center text-sm text-muted-foreground">
                                还没有文章,从上面选一篇加入。
                            </p>
                        )}
                    </div>

                    {error ? <p className="text-xs text-destructive">{error}</p> : null}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        取消
                    </Button>
                    <Button onClick={() => save.mutate()} disabled={save.isPending || detail.isLoading}>
                        {save.isPending ? '保存中…' : '保存顺序'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
