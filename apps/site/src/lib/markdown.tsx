import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

/**
 * Markdown 渲染(RSC:构建期渲染成静态 HTML,产物零运行时 JS)
 *
 * 2026-10-20 重构:弃用 marked + shiki 组合 —— shiki 的双主题行内变量
 * 与 marked 的 <pre> 嵌套反复出问题(亮色丢高亮/双层代码块)。
 *
 * 现在:react-markdown + remark-gfm(表格)+ rehype-highlight(highlight.js),
 * 代码块固定「暗色编辑器」风格(GitHub Dark,两个主题下都专业,类 MDN),
 * token 色由 highlight.js 官方主题 CSS 提供(globals.css 里 import),
 * 从根上消灭「双主题切换」这类 bug。
 */
export function Markdown({ children }: { children: string }) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
        >
            {children}
        </ReactMarkdown>
    )
}
