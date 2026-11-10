import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { collectionsApi, type Collection, type CollectionStatus } from '@/services/collections-api'
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
import { Textarea } from '@/components/ui/textarea'
import Select from '@/components/ui/select'

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    collection: Collection | null
}

const EMPTY = {
    title: '',
    slug: '',
    description: '',
    sort: '0',
    status: 'draft' as CollectionStatus,
}

export function CollectionDialog({ open, onOpenChange, collection }: Props) {
    const queryClient = useQueryClient()
    const [form, setForm] = useState(EMPTY)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        setError(null)
        setForm(
            collection
                ? {
                      title: collection.title,
                      slug: collection.slug,
                      description: collection.description ?? '',
                      sort: String(collection.sort),
                      status: collection.status === 'approved' ? 'approved' : 'draft',
                  }
                : EMPTY,
        )
    }, [open, collection])

    const save = useMutation({
        mutationFn: () => {
            const payload = {
                title: form.title.trim(),
                slug: form.slug.trim() || undefined,
                description: form.description.trim() || undefined,
                sort: Number(form.sort) || 0,
                status: form.status,
            }
            return collection
                ? collectionsApi.update(collection.id, payload)
                : collectionsApi.create(payload)
        },
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
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{collection ? '编辑合集' : '新建合集'}</DialogTitle>
                    <DialogDescription>
                        合集只聚合文章。创建后到「管理文章」里挑选文章并排序。
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-3">
                    <div className="grid gap-1.5">
                        <Label htmlFor="c-title">标题</Label>
                        <Input
                            id="c-title"
                            value={form.title}
                            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                            placeholder="例如:前端工程化"
                        />
                    </div>

                    <div className="grid gap-1.5">
                        <Label htmlFor="c-slug">
                            Slug <span className="text-xs text-muted-foreground">(只能小写字母/数字/连字符)</span>
                        </Label>
                        <Input
                            id="c-slug"
                            value={form.slug}
                            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                            placeholder="frontend-engineering"
                        />
                    </div>

                    <div className="grid gap-1.5">
                        <Label htmlFor="c-desc">简介</Label>
                        <Textarea
                            id="c-desc"
                            value={form.description}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, description: e.target.value }))
                            }
                            placeholder="这个合集讲什么、适合谁读"
                            rows={4}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label htmlFor="c-sort">排序(小的在前)</Label>
                            <Input
                                id="c-sort"
                                value={form.sort}
                                onChange={(e) => setForm((f) => ({ ...f, sort: e.target.value }))}
                                inputMode="numeric"
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label>状态</Label>
                            <Select
                                value={form.status}
                                onChange={(v) => setForm((f) => ({ ...f, status: v as CollectionStatus }))}
                                options={[
                                    { label: '草稿', value: 'draft' },
                                    { label: '已发布', value: 'approved' },
                                ]}
                            />
                        </div>
                    </div>

                    {error ? <p className="text-xs text-destructive">{error}</p> : null}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        取消
                    </Button>
                    <Button onClick={() => save.mutate()} disabled={save.isPending || !form.title.trim()}>
                        {save.isPending ? '保存中…' : '保存'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
