import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ArrowLeft, Check, ExternalLink, Loader2, Save, Undo2 } from 'lucide-react'
import {
    articlesApi,
    type Article,
    type ArticleKind,
    type ArticleStatus,
} from '@/services/articles-api'
import { MarkdownField } from '@/components/markdown-field'
import { Markdown } from '@/components/markdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import Select from '@/components/ui/select'
import { cn } from '@/lib/utils'

const SITE_BASE = 'https://code.kskbl.com.cn'

interface FormState {
    kind: ArticleKind
    title: string
    slug: string
    excerpt: string
    contentMd: string
    externalUrl: string
    comment: string
    tags: string
    status: ArticleStatus
}

const EMPTY: FormState = {
    kind: 'own',
    title: '',
    slug: '',
    excerpt: '',
    contentMd: '',
    externalUrl: '',
    comment: '',
    tags: '',
    status: 'draft',
}

const STATUS_LABEL: Record<ArticleStatus, string> = {
    draft: '草稿',
    pending_review: '待审核',
    approved: '已发布',
    rejected: '已驳回',
}

const STATUS_CLASS: Record<ArticleStatus, string> = {
    draft: 'bg-muted text-muted-foreground',
    pending_review: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
}

function toForm(a: Article): FormState {
    return {
        kind: a.kind,
        title: a.title,
        slug: a.slug,
        excerpt: a.excerpt ?? '',
        contentMd: a.contentMd ?? '',
        externalUrl: a.externalUrl ?? '',
        comment: a.comment ?? '',
        tags: (a.tags ?? []).join(', '),
        status: a.status,
    }
}

export default function ArticleEditorPage() {
    const { id = 'new' } = useParams<{ id: string }>()
    const isNew = id === 'new'
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    const [form, setForm] = useState<FormState>(EMPTY)
    const [snapshot, setSnapshot] = useState<string>(JSON.stringify(EMPTY))
    const [error, setError] = useState<string | null>(null)
    const [savedAt, setSavedAt] = useState<string | null>(null)
    const [showMeta, setShowMeta] = useState(true)
    const previewRef = useRef<HTMLDivElement>(null)

    const { data, isLoading } = useQuery({
        queryKey: ['article', id],
        queryFn: () => articlesApi.get(id),
        enabled: !isNew,
    })

    useEffect(() => {
        if (!data) return
        const next = toForm(data)
        setForm(next)
        setSnapshot(JSON.stringify(next))
    }, [data])

    const dirty = JSON.stringify(form) !== snapshot
    const tags = useMemo(
        () =>
            form.tags
                .split(/[,，]/)
                .map((t) => t.trim())
                .filter(Boolean)
                .slice(0, 20),
        [form.tags],
    )

    const save = useMutation({
        mutationFn: async (status: ArticleStatus) => {
            const payload = {
                kind: form.kind,
                title: form.title.trim(),
                slug: form.slug.trim() || undefined,
                excerpt: form.excerpt.trim() || undefined,
                contentMd: form.kind === 'own' ? form.contentMd : undefined,
                externalUrl: form.kind === 'curated' ? form.externalUrl.trim() || undefined : undefined,
                comment: form.comment.trim() || undefined,
                tags,
                status,
            }
            if (isNew) return articlesApi.create(payload)
            return articlesApi.update(id, payload)
        },
        onSuccess: (saved) => {
            const next = toForm(saved as Article)
            setForm(next)
            setSnapshot(JSON.stringify(next))
            setError(null)
            setSavedAt(new Date().toLocaleTimeString('zh-CN'))
            queryClient.invalidateQueries({ queryKey: ['articles'] })
            queryClient.invalidateQueries({ queryKey: ['article', id] })
            if (isNew) navigate(`/articles/${(saved as Article).id}`, { replace: true })
        },
        onError: (err: unknown) => {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                (err as Error)?.message ??
                '保存失败'
            setError(msg)
        },
    })

    const onKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault()
                if (!save.isPending) save.mutate(form.status)
            }
        },
        [save, form.status],
    )

    useEffect(() => {
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [onKeyDown])

    if (!isNew && isLoading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-[60vh] w-full" />
            </div>
        )
    }

    if (!isNew && !data) {
        return (
            <div className="rounded-lg border border-dashed p-14 text-center text-sm text-muted-foreground">
                文章不存在或已被删除。
            </div>
        )
    }

    const previewUrl = form.slug ? `${SITE_BASE}/article/${form.slug}` : null
    const canPublish =
        form.title.trim().length > 0 &&
        (form.kind === 'own' ? form.contentMd.trim().length > 0 : form.externalUrl.trim().length > 0)

    return (
        <div className="flex h-full min-h-0 flex-col gap-3">
            {/* 顶部:标题 + 状态 + 操作 */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                <Button variant="ghost" size="sm" asChild className="flex-none text-muted-foreground">
                    <Link to="/articles">
                        <ArrowLeft className="mr-1.5 h-4 w-4" />
                        文章
                    </Link>
                </Button>

                <Input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder={isNew ? '新文章标题' : '文章标题'}
                    className="min-w-0 flex-1 border-0 bg-transparent px-1 font-serif text-[17px] font-medium shadow-none focus-visible:ring-0"
                />

                <span
                    className={cn(
                        'flex-none rounded-full px-2 py-0.5 text-[11px]',
                        STATUS_CLASS[form.status],
                    )}
                >
                    {STATUS_LABEL[form.status]}
                </span>

                {dirty ? (
                    <span className="flex-none font-mono text-[10.5px] text-amber-600">
                        未保存
                    </span>
                ) : savedAt ? (
                    <span className="flex-none font-mono text-[10.5px] text-muted-foreground">
                        已保存 {savedAt}
                    </span>
                ) : null}

                <div className="ml-auto flex flex-none items-center gap-1.5">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowMeta((v) => !v)}
                        className="text-muted-foreground"
                    >
                        {showMeta ? '收起设置' : '文章设置'}
                    </Button>

                    {form.status === 'approved' && previewUrl ? (
                        <Button variant="outline" size="sm" asChild>
                            <a href={previewUrl} target="_blank" rel="noreferrer">
                                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                看线上
                            </a>
                        </Button>
                    ) : previewUrl ? (
                        <Button variant="outline" size="sm" asChild>
                            <a href={previewUrl} target="_blank" rel="noreferrer">
                                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                预览链接
                            </a>
                        </Button>
                    ) : null}

                    <Button
                        variant="outline"
                        size="sm"
                        disabled={save.isPending}
                        onClick={() => save.mutate('draft')}
                    >
                        {save.isPending ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Save className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {form.status === 'approved' ? '下线' : '存草稿'}
                    </Button>

                    {form.status === 'approved' ? null : (
                        <Button
                            size="sm"
                            disabled={save.isPending || !canPublish}
                            onClick={() => save.mutate('approved')}
                        >
                            {save.isPending ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Check className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            发布
                        </Button>
                    )}
                </div>
            </div>

            {error ? (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-none" />
                    <span>{error}</span>
                </div>
            ) : null}

            {/* 正文:编辑 + 预览 + 设置 */}
            <div
                className={cn(
                    'grid min-h-0 flex-1 gap-3',
                    showMeta
                        ? 'xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_280px]'
                        : 'xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]',
                )}
            >
                <div className="flex min-h-0 flex-col">
                    {form.kind === 'own' && form.contentMd.trimStart().startsWith('# ') ? (
                        <p className="mb-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-300">
                            正文开头的 H1 会和页面标题重复,前台渲染时已自动去掉(这里仍然保留原文)。
                        </p>
                    ) : null}
                    <MarkdownField
                        value={form.kind === 'own' ? form.contentMd : form.comment}
                        onChange={(v) =>
                            setForm((f) =>
                                f.kind === 'own' ? { ...f, contentMd: v } : { ...f, comment: v },
                            )
                        }
                        height="100%"
                        placeholder={
                            form.kind === 'own'
                                ? '正文,支持 Markdown'
                                : '荐文导读:为什么值得读(2-3 句)'
                        }
                        className="h-full"
                    />
                </div>

                <div className="min-h-0 overflow-y-auto rounded-lg border border-border bg-card p-5">
                    {form.kind === 'curated' ? (
                        <div className="space-y-3">
                            <p className="font-mono text-[10.5px] tracking-[0.14em] text-muted-foreground">
                                CURATED LINK
                            </p>
                            <h1 className="font-serif text-[26px] leading-snug">{form.title || '未命名'}</h1>
                            <p className="text-[14px] leading-7 text-muted-foreground">{form.comment}</p>
                            {form.externalUrl ? (
                                <a
                                    href={form.externalUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[13px] text-primary underline underline-offset-2"
                                >
                                    阅读原文 ↗
                                </a>
                            ) : null}
                        </div>
                    ) : form.contentMd.trim() ? (
                        <Markdown>{form.contentMd}</Markdown>
                    ) : (
                        <p className="text-sm text-muted-foreground">左侧开始写,这里是实时预览。</p>
                    )}
                </div>

                {showMeta ? (
                    <aside className="min-h-0 space-y-4 overflow-y-auto rounded-lg border border-border bg-card p-3">
                        <div className="grid gap-1.5">
                            <Label>类型</Label>
                            <Select
                                value={form.kind}
                                onChange={(v) => setForm((f) => ({ ...f, kind: v as ArticleKind }))}
                                options={[
                                    { label: '原创图文', value: 'own' },
                                    { label: '外部荐文', value: 'curated' },
                                ]}
                            />
                        </div>

                        <div className="grid gap-1.5">
                            <Label>slug</Label>
                            <Input
                                value={form.slug}
                                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                                placeholder="mini-sentry-from-scratch"
                                className="font-mono text-[12px]"
                            />
                            <p className="text-[10.5px] text-muted-foreground">
                                只能小写字母、数字、连字符;不填则自动生成。
                            </p>
                        </div>

                        <div className="grid gap-1.5">
                            <Label>状态</Label>
                            <Select
                                value={form.status}
                                onChange={(v) => setForm((f) => ({ ...f, status: v as ArticleStatus }))}
                                options={[
                                    { label: '草稿', value: 'draft' },
                                    { label: '待审核', value: 'pending_review' },
                                    { label: '已发布', value: 'approved' },
                                    { label: '已驳回', value: 'rejected' },
                                ]}
                            />
                        </div>

                        <div className="grid gap-1.5">
                            <Label>摘要</Label>
                            <Textarea
                                value={form.excerpt}
                                onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                                rows={3}
                                placeholder="列表页和 SEO 描述用"
                                className="text-[12.5px]"
                            />
                        </div>

                        <div className="grid gap-1.5">
                            <Label>标签</Label>
                            <Input
                                value={form.tags}
                                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                                placeholder="Sentry, 错误监控"
                                className="text-[12.5px]"
                            />
                        </div>

                        {form.kind === 'curated' ? (
                            <>
                                <div className="grid gap-1.5">
                                    <Label>原文链接</Label>
                                    <Input
                                        value={form.externalUrl}
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, externalUrl: e.target.value }))
                                        }
                                        placeholder="https://"
                                        className="font-mono text-[12px]"
                                    />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label>导读</Label>
                                    <Textarea
                                        value={form.comment}
                                        onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                                        rows={4}
                                        className="text-[12.5px]"
                                    />
                                </div>
                            </>
                        ) : null}

                        <div className="border-t border-border pt-3 font-mono text-[10.5px] text-muted-foreground">
                            <p>正文字数 {form.contentMd.length.toLocaleString()}</p>
                            <p className="mt-1">Ctrl/⌘ + S 保存</p>
                        </div>
                    </aside>
                ) : null}
            </div>
        </div>
    )
}
