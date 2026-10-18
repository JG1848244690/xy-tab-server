/**
 * markdown → HTML,构建期执行。
 *
 * 代码高亮用 shiki(plan §3.1:构建期高亮,产物里没有 highlight.js 那种
 * 运行时 JS);正文样式走 globals.css 的 .markdown 类。
 */
import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'

// 单例:构建期多个页面复用同一个 highlighter 实例
// (shiki v3 的类型导出在 package.json exports 里拿不到,这里以实现为准不追类型)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let highlighterPromise: Promise<any> | null = null

async function getHighlighter() {
    // 动态 import:没配 shiki 的构建路径(SITE_NO_SHIKI 诊断)完全不加载它
    const { createHighlighter } = await import('shiki')
    highlighterPromise ??= createHighlighter({
        themes: ['github-dark', 'github-light'],
        langs: ['javascript', 'typescript', 'jsx', 'tsx', 'json', 'css', 'html', 'bash', 'sql'],
    })
    return highlighterPromise
}

/** 同步 marked 实例;高亮经 marked-highlight 的异步钩子在渲染时补 */
const marked = new Marked(
    markedHighlight({
        emptyLangClass: 'hljs',
        async: true,
        async highlight(code, lang) {
            try {
                const highlighter = await getHighlighter()
                const langId = highlighter.getLoadedLanguages().includes(lang as never)
                    ? lang
                    : 'text'
                return highlighter.codeToHtml(code, {
                    lang: langId,
                    themes: { dark: 'github-dark', light: 'github-light' },
                })
            } catch {
                // 高亮失败不阻塞构建:退化为无高亮的 <pre>
                return code
            }
        },
    }),
)

export async function renderMarkdown(md: string): Promise<string> {
    return marked.parse(md, { async: true }) as Promise<string>
}

/**
 * 【诊断开关】shiki 的 oniguruma wasm 在 Windows 构建worker 里疑似崩进程
 * (失败页面恰为 question 之后的路由,见提交讨论)。设 SITE_NO_SHIKI=1
 * 可跳过高亮做对照实验;CI(Linux)正常路径不受影响。
 */
export async function renderMarkdownSafe(md: string): Promise<string> {
    if (process.env.SITE_NO_SHIKI) {
        const escaped = md.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]!)
        return `<pre>${escaped}</pre>`
    }
    return renderMarkdown(md)
}
