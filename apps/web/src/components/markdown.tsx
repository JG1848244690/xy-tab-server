import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { cn } from '@/lib/utils'

interface MarkdownProps {
    children: string
    className?: string
}

/**
 * 统一 Markdown 渲染器。
 *
 * 之前用 md-editor-rt 的 MdPreview:它自带整套文档样式和行号渲染,
 * 在练习页里既和纸色界面冲突,代码块的行号还会错位。
 * 这里改用 react-markdown + remark-gfm + rehype-highlight,
 * 与前台的渲染链保持一致,样式统一由 globals.css 的 .markdown-body 控制。
 */
export function Markdown({ children, className }: MarkdownProps) {
    return (
        <div className={cn('markdown-body', className)}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
            >
                {children}
            </ReactMarkdown>
        </div>
    )
}
