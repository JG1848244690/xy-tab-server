/* eslint-disable react-hooks/refs -- 工具栏回调只在点击时读取 textarea ref,不是渲染期访问 */
import { useRef, useState } from 'react'
import {
    Bold,
    Italic,
    Code,
    List,
    Quote,
    Link2,
    ImagePlus,
    Heading2,
    Eye,
    Columns2,
    Pencil,
} from 'lucide-react'
import { Markdown } from '@/components/markdown'
import { uploadEditorImages } from '@/services/media-api'
import { cn } from '@/lib/utils'

type ViewMode = 'edit' | 'split' | 'preview'

interface MarkdownFieldProps {
    value: string
    onChange: (value: string) => void
    /** 编辑区高度,默认 400px */
    height?: number
    placeholder?: string
    className?: string
}

/**
 * 轻量 Markdown 编辑器:文本域 + 工具栏 + 预览。
 *
 * 替换 md-editor-rt:后者自带行号渲染和整套文档样式,预览里的代码会串行,
 * 而且打包体积大。这里只保留录题需要的几个动作(加粗/代码/链接/图片/列表),
 * 支持粘贴和拖拽图片自动上传。
 */
export function MarkdownField({
    value,
    onChange,
    height = 400,
    placeholder = '支持 Markdown,可粘贴/拖拽图片',
    className,
}: MarkdownFieldProps) {
    const ref = useRef<HTMLTextAreaElement>(null)
    const fileRef = useRef<HTMLInputElement>(null)
    const [view, setView] = useState<ViewMode>('edit')

    const apply = (next: string, caretStart: number, caretEnd: number) => {
        onChange(next)
        requestAnimationFrame(() => {
            const el = ref.current
            if (!el) return
            el.focus()
            el.setSelectionRange(caretStart, caretEnd)
        })
    }

    /** 用 before/after 包住选区;没有选区时插入占位文字 */
    const wrap = (before: string, after = '', placeholderText = '') => {
        const el = ref.current
        if (!el) return
        const start = el.selectionStart
        const end = el.selectionEnd
        const selected = value.slice(start, end) || placeholderText
        const next = value.slice(0, start) + before + selected + after + value.slice(end)
        apply(next, start + before.length, start + before.length + selected.length)
    }

    /** 行首插入(列表/引用/标题) */
    const prefixLine = (prefix: string) => {
        const el = ref.current
        if (!el) return
        const start = el.selectionStart
        const lineStart = value.lastIndexOf('\n', start - 1) + 1
        const next = value.slice(0, lineStart) + prefix + value.slice(lineStart)
        apply(next, start + prefix.length, start + prefix.length)
    }

    const insertText = (text: string) => {
        const el = ref.current
        const start = el?.selectionStart ?? value.length
        const next = value.slice(0, start) + text + value.slice(start)
        apply(next, start + text.length, start + text.length)
    }

    const uploadFiles = (files: File[]) => {
        if (!files.length) return
        uploadEditorImages(files, (urls) => {
            insertText(urls.map((u) => `![${u.alt}](${u.url})`).join('\n'))
        })
    }

    const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'))
        if (!files.length) return
        e.preventDefault()
        uploadFiles(files)
    }

    const onDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
        if (!files.length) return
        e.preventDefault()
        uploadFiles(files)
    }

    const tools = [
        { title: '二级标题', icon: Heading2, run: () => prefixLine('## ') },
        { title: '加粗', icon: Bold, run: () => wrap('**', '**', '加粗文字') },
        { title: '斜体', icon: Italic, run: () => wrap('*', '*', '斜体文字') },
        { title: '行内代码', icon: Code, run: () => wrap('`', '`', 'code') },
        {
            title: '代码块',
            icon: Code,
            run: () => wrap('\n```\n', '\n```\n', '// code'),
        },
        { title: '无序列表', icon: List, run: () => prefixLine('- ') },
        { title: '引用', icon: Quote, run: () => prefixLine('> ') },
        { title: '链接', icon: Link2, run: () => wrap('[', '](https://)', '链接文字') },
    ]

    return (
        <div className={cn('overflow-hidden rounded-lg border border-border bg-card', className)}>
            {/* 工具栏 */}
            <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-card/60 px-1.5 py-1">
                {tools.map((t) => (
                    <button
                        key={t.title}
                        type="button"
                        title={t.title}
                        onClick={t.run}
                        className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                        <t.icon className="h-3.5 w-3.5" />
                    </button>
                ))}
                <button
                    type="button"
                    title="上传图片"
                    onClick={() => fileRef.current?.click()}
                    className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                    <ImagePlus className="h-3.5 w-3.5" />
                </button>
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                        uploadFiles(Array.from(e.target.files ?? []))
                        e.target.value = ''
                    }}
                />

                <div className="ml-auto flex items-center rounded-md border border-border p-0.5">
                    {(
                        [
                            { key: 'edit', icon: Pencil, title: '编辑' },
                            { key: 'split', icon: Columns2, title: '分屏' },
                            { key: 'preview', icon: Eye, title: '预览' },
                        ] as const
                    ).map((v) => (
                        <button
                            key={v.key}
                            type="button"
                            title={v.title}
                            onClick={() => setView(v.key)}
                            className={cn(
                                'rounded px-1.5 py-0.5 transition-colors',
                                view === v.key
                                    ? 'bg-background text-foreground'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            <v.icon className="h-3.5 w-3.5" />
                        </button>
                    ))}
                </div>
            </div>

            {/* 编辑 / 预览 */}
            <div
                className={cn('grid', view === 'split' ? 'grid-cols-2' : 'grid-cols-1')}
                style={{ height }}
            >
                <div
                    className={cn(
                        'min-h-0 min-w-0',
                        view === 'preview' && 'hidden',
                        view === 'split' && 'border-r border-border',
                    )}
                >
                    <textarea
                        ref={ref}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onPaste={onPaste}
                        onDrop={onDrop}
                        placeholder={placeholder}
                        spellCheck={false}
                        className="h-full w-full resize-none border-0 bg-transparent p-3 font-mono text-[13px] leading-7 outline-none placeholder:text-muted-foreground/70"
                    />
                </div>
                {view !== 'edit' ? (
                    <div className="min-h-0 min-w-0 overflow-y-auto p-3">
                        {value.trim() ? (
                            <Markdown>{value}</Markdown>
                        ) : (
                            <p className="text-sm text-muted-foreground">还没有内容。</p>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    )
}
