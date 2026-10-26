import ReactMarkdown, { type Components, type ExtraProps } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Children, isValidElement, type ComponentPropsWithoutRef } from 'react'

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
 *
 * 图文(2026-10-26):图片走标准 markdown `![说明](https://static.xxx/img.png)`,
 * 托管在独立 static 子域;这里只负责渲染:
 *  - 响应式(不撑破正文)、懒加载、点图看原图
 *  - 图片单独成段时,alt 作为图注显示在下方
 *  - 不启用 raw HTML(rehype-raw),避免把 UGC 变成 XSS 入口
 */

type ImageProps = ComponentPropsWithoutRef<'img'> & ExtraProps

function MarkdownImage({ node: _node, alt, title, src, ...rest }: ImageProps) {
    // src 在 React 19 类型里可能是 Blob(文件对象);markdown 场景只接受 URL 字符串
    if (!src || typeof src !== 'string') return null
    return (
        <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block max-w-full"
            aria-label={alt ? `查看大图:${alt}` : '查看大图'}
        >
            <img
                {...rest}
                src={src}
                alt={alt ?? ''}
                title={title}
                loading="lazy"
                decoding="async"
                className="max-h-[560px] max-w-full rounded-lg border border-border bg-muted object-contain"
            />
        </a>
    )
}

const markdownComponents: Components = {
    img: MarkdownImage,
    // 图片单独成段(最常见的写法)→ figure + 图注;
    // 注意不能用 <figure> 套在 <p> 里(非法 HTML,浏览器会拆结构)
    p: ({ children }) => {
        const parts = Children.toArray(children)
        if (
            parts.length === 1 &&
            isValidElement(parts[0]) &&
            parts[0].type === MarkdownImage
        ) {
            const alt = (parts[0].props as ImageProps).alt
            return (
                <figure className="my-5 flex flex-col items-center gap-2">
                    {children}
                    {alt ? (
                        <figcaption className="text-xs text-muted-foreground">{alt}</figcaption>
                    ) : null}
                </figure>
            )
        }
        return <p>{children}</p>
    },
}

export function Markdown({ children }: { children: string }) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
            components={markdownComponents}
        >
            {children}
        </ReactMarkdown>
    )
}
