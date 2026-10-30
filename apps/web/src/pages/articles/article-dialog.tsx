import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { articlesApi, type Article, type ArticleInput, type ArticleKind } from '@/services/articles-api'
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
    article: Article | null
}

const EMPTY = {
    kind: 'own' as ArticleKind,
    title: '',
    slug: '',
    excerpt: '',
    contentMd: '',
    externalUrl: '',
    comment: '',
    tags: '',
    status: 'draft' as 'draft' | 'approved',
}

export function ArticleDialog({ open, onOpenChange, article }: Props) {
    const queryClient = useQueryClient()
    const [form, setForm] = useState(EMPTY)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        setError(null)
        setForm(
            article
                ? {
                      kind: article.kind,
                      title: article.title,
                      slug: article.slug,
                      excerpt: article.excerpt ?? '',
                      contentMd: article.contentMd ?? '',
                      externalUrl: article.externalUrl ?? '',
                      comment: article.comment ?? '',
                      tags: (article.tags ?? []).join(', '),
                      status: article.status === 'approved' ? 'approved' : 'draft',
                  }
                : EMPTY,
        )
    }, [open, article])

    const save = useMutation({
        mutationFn: async () => {
            const payload: ArticleInput = {
                kind: form.kind,
                title: form.title.trim(),
                slug: form.slug.trim() || undefined,
                excerpt: form.excerpt.trim() || undefined,
                contentMd: form.kind === 'own' ? form.contentMd : undefined,
                externalUrl: form.kind === 'curated' ? form.externalUrl.trim() : undefined,
                comment: form.kind === 'curated' ? form.comment.trim() : undefined,
                tags: form.tags
                    .split(',')
                    .map((x) => x.trim())
                    .filter(Boolean),
                status: form.status,
            }
            if (!payload.title) throw new Error('标题不能为空')
            if (payload.status === 'approved') {
                if (payload.kind === 'own' && !payload.contentMd?.trim())
                    throw new Error('发布原创文章前请填写正文')
                if (payload.kind === 'curated' && !payload.externalUrl)
                    throw new Error('发布荐文前请填写外链')
            }
            return article
                ? articlesApi.update(article.id, payload)
                : articlesApi.create(payload)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['articles'] })
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

    const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
        setForm((prev) => ({ ...prev, [key]: value }))

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
                <DialogHeader>
                    <DialogTitle>{article ? '编辑文章' : '新建文章'}</DialogTitle>
                    <DialogDescription>
                        原创文章写 Markdown;荐文填外部链接和一句推荐语。
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>类型</Label>
                            <Select
                                value={form.kind}
                                disabled={!!article}
                                onChange={(v) => set('kind', v as ArticleKind)}
                                options={[
                                    { label: '原创文章', value: 'own' },
                                    { label: '荐文 / 博客链接', value: 'curated' },
                                ]}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>状态</Label>
                            <Select
                                value={form.status}
                                onChange={(v) => set('status', v as 'draft' | 'approved')}
                                options={[
                                    { label: '草稿', value: 'draft' },
                                    { label: '发布', value: 'approved' },
                                ]}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="article-title">标题 *</Label>
                        <Input
                            id="article-title"
                            value={form.title}
                            onChange={(e) => set('title', e.target.value)}
                            placeholder="一句话说清这篇文章讲什么"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="article-slug">Slug(可留空自动生成)</Label>
                        <Input
                            id="article-slug"
                            value={form.slug}
                            onChange={(e) => set('slug', e.target.value)}
                            placeholder="例如 react-fiber-notes"
                        />
                        <p className="text-xs text-muted-foreground">
                            只能用英文小写、数字和连字符;发布后就是 /article/&lt;slug&gt;。
                        </p>
                    </div>

                    {form.kind === 'own' ? (
                        <div className="space-y-2">
                            <Label htmlFor="article-content">正文(Markdown)</Label>
                            <Textarea
                                id="article-content"
                                value={form.contentMd}
                                onChange={(e) => set('contentMd', e.target.value)}
                                className="min-h-[280px] font-mono text-[13px] leading-6"
                                placeholder={'## 小节标题\n\n正文内容,支持 Markdown。'}
                            />
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="article-url">外部链接 *</Label>
                                <Input
                                    id="article-url"
                                    value={form.externalUrl}
                                    onChange={(e) => set('externalUrl', e.target.value)}
                                    placeholder="https://example.com/blog/post"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="article-comment">推荐语</Label>
                                <Textarea
                                    id="article-comment"
                                    value={form.comment}
                                    onChange={(e) => set('comment', e.target.value)}
                                    className="min-h-[80px]"
                                    placeholder="为什么值得读?2-3 句话。"
                                />
                            </div>
                        </>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="article-excerpt">摘要(可留空自动生成)</Label>
                        <Textarea
                            id="article-excerpt"
                            value={form.excerpt}
                            onChange={(e) => set('excerpt', e.target.value)}
                            className="min-h-[64px]"
                            placeholder="列表页展示的一句话摘要"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="article-tags">标签</Label>
                        <Input
                            id="article-tags"
                            value={form.tags}
                            onChange={(e) => set('tags', e.target.value)}
                            placeholder="用逗号分隔,例如:React, 性能"
                        />
                    </div>

                    {error ? <p className="text-sm text-destructive">{error}</p> : null}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        取消
                    </Button>
                    <Button onClick={() => save.mutate()} disabled={save.isPending}>
                        {save.isPending ? '保存中…' : '保存'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
