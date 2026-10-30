import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Link2, Trash2 } from 'lucide-react'
import { articlesApi, type Article, type ArticleKind, type ArticleStatus } from '@/services/articles-api'
import { ArticleDialog } from './article-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

const STATUS_LABEL: Record<ArticleStatus, string> = {
    draft: '草稿',
    pending_review: '待审',
    approved: '已发布',
    rejected: '已驳回',
}

const STATUS_CLASS: Record<ArticleStatus, string> = {
    draft: 'bg-muted text-muted-foreground',
    pending_review: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
}

function fmtDate(value: string | null) {
    if (!value) return '—'
    return new Date(value).toLocaleDateString('zh-CN')
}

export default function ArticlesPage() {
    const queryClient = useQueryClient()
    const [kind, setKind] = useState<'all' | ArticleKind>('all')
    const [status, setStatus] = useState<'all' | ArticleStatus>('all')
    const [q, setQ] = useState('')
    const [page, setPage] = useState(1)
    const [open, setOpen] = useState(false)
    const [editing, setEditing] = useState<Article | null>(null)
    const [quickUrl, setQuickUrl] = useState('')
    const [quickError, setQuickError] = useState<string | null>(null)

    const filters = useMemo(
        () => ({
            kind: kind === 'all' ? undefined : kind,
            status: status === 'all' ? undefined : status,
            q: q.trim() || undefined,
            page,
            size: PAGE_SIZE,
        }),
        [kind, status, q, page],
    )

    const { data, isLoading } = useQuery({
        queryKey: ['articles', filters],
        queryFn: () => articlesApi.list(filters),
    })

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['articles'] })

    const togglePublish = useMutation({
        mutationFn: (article: Article) =>
            articlesApi.update(article.id, {
                status: article.status === 'approved' ? 'draft' : 'approved',
            }),
        onSuccess: invalidate,
    })

    const remove = useMutation({
        mutationFn: (id: string) => articlesApi.remove(id),
        onSuccess: invalidate,
    })

    /** 只贴一个 URL:自动抓标题/描述并直接发布成荐文 */
    const quickAdd = useMutation({
        mutationFn: (url: string) =>
            articlesApi.create({ kind: 'curated', externalUrl: url, status: 'approved' }),
        onSuccess: () => {
            setQuickUrl('')
            setQuickError(null)
            invalidate()
        },
        onError: (err: unknown) => {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                (err as Error)?.message ??
                '添加失败'
            setQuickError(msg)
        },
    })

    const submitQuick = () => {
        const url = quickUrl.trim()
        if (!/^https?:\/\/\S+$/i.test(url)) {
            setQuickError('请粘贴完整链接(以 http:// 或 https:// 开头)')
            return
        }
        quickAdd.mutate(url)
    }

    const rows = data?.data ?? []
    const total = data?.total ?? 0
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    return (
        <div className="flex h-full flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold">文章</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        原创文章与外部荐文。发布后由定时构建同步到前台。
                    </p>
                </div>
                <Button
                    onClick={() => {
                        setEditing(null)
                        setOpen(true)
                    }}
                >
                    <Plus className="mr-1 h-4 w-4" />
                    新建文章
                </Button>
            </div>

            <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2">
                    <Link2 className="ml-1 h-4 w-4 flex-none text-muted-foreground" />
                    <Input
                        value={quickUrl}
                        onChange={(e) => {
                            setQuickUrl(e.target.value)
                            setQuickError(null)
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') submitQuick()
                        }}
                        placeholder="刷到好链接?粘贴 URL,回车直接发布成荐文"
                        className="border-0 shadow-none focus-visible:ring-0"
                    />
                    <Button
                        onClick={submitQuick}
                        disabled={quickAdd.isPending || !quickUrl.trim()}
                        className="flex-none"
                    >
                        {quickAdd.isPending ? '抓取中…' : '存链接'}
                    </Button>
                </div>
                <p className="mt-1 pl-7 text-[11px] text-muted-foreground">
                    只填 URL 即可,标题和摘要会自动抓取;抓不到就用域名兜底。
                </p>
                {quickError ? <p className="mt-1 pl-7 text-xs text-destructive">{quickError}</p> : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="w-32">
                    <Select
                        value={kind}
                        onChange={(v) => {
                            setKind(v as 'all' | ArticleKind)
                            setPage(1)
                        }}
                        options={[
                            { label: '全部类型', value: 'all' },
                            { label: '原创', value: 'own' },
                            { label: '荐文', value: 'curated' },
                        ]}
                    />
                </div>
                <div className="w-32">
                    <Select
                        value={status}
                        onChange={(v) => {
                            setStatus(v as 'all' | ArticleStatus)
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
                <span className="ml-auto text-xs text-muted-foreground">共 {total} 篇</span>
            </div>

            <div className="overflow-hidden rounded-lg border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>标题</TableHead>
                            <TableHead className="w-20">类型</TableHead>
                            <TableHead className="w-24">状态</TableHead>
                            <TableHead className="w-28">发布时间</TableHead>
                            <TableHead className="w-36 text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={5}>
                                        <Skeleton className="h-6 w-full" />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : rows.length ? (
                            rows.map((article) => (
                                <TableRow key={article.id}>
                                    <TableCell>
                                        <div className="font-medium">{article.title}</div>
                                        <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                                            /article/{article.slug}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {article.kind === 'own' ? '原创' : '荐文'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <span
                                            className={`inline-flex rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[article.status]}`}
                                        >
                                            {STATUS_LABEL[article.status]}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {fmtDate(article.publishedAt)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setEditing(article)
                                                    setOpen(true)
                                                }}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => togglePublish.mutate(article)}
                                                disabled={togglePublish.isPending}
                                            >
                                                {article.status === 'approved' ? '下线' : '发布'}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() => {
                                                    if (window.confirm(`删除《${article.title}》?`))
                                                        remove.mutate(article.id)
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
                                <TableCell colSpan={5} className="py-16 text-center text-sm text-muted-foreground">
                                    还没有文章,点右上角「新建文章」。
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

            <ArticleDialog open={open} onOpenChange={setOpen} article={editing} />
        </div>
    )
}
