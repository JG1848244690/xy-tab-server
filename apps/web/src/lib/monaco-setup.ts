/**
 * monaco 本地化(F2):@monaco-editor/react 默认从 jsDelivr CDN 运行时加载
 * monaco —— 内网/弱网直接挂,还引入第三方域名依赖。这里改为指向本地
 * monaco-editor 包(bundle 进构建产物,随练习页 chunk 懒加载)。
 *
 * 引入方式是副作用 import:import '@/lib/monaco-setup'
 * 必须在 <Editor/> 挂载前执行,放模块顶层即可。
 */
import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'

self.MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
        switch (label) {
            case 'json':
                return new jsonWorker()
            case 'css':
            case 'scss':
            case 'less':
                return new cssWorker()
            case 'html':
            case 'handlebars':
            case 'razor':
                return new htmlWorker()
            case 'typescript':
            case 'javascript':
                return new tsWorker()
            default:
                return new editorWorker()
        }
    },
}

loader.config({ monaco })

/**
 * 自定义编辑器主题:纸色/墨色,和后台上下的界面一致。
 * monaco 内置只有 vs / vs-dark,直接传 'light' 会落到默认白底。
 */
monaco.editor.defineTheme('paper-light', {
    base: 'vs',
    inherit: true,
    rules: [
        { token: 'comment', foreground: '8a8478', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'a93a31' },
        { token: 'string', foreground: '2f6b57' },
        { token: 'number', foreground: 'a15c2f' },
    ],
    colors: {
        'editor.background': '#fbfaf6',
        'editor.foreground': '#141310',
        'editorGutter.background': '#fbfaf6',
        'editor.lineHighlightBackground': '#f1eee2',
        'editorLineNumber.foreground': '#b9b2a3',
        'editorLineNumber.activeForeground': '#6e6a60',
        'editor.selectionBackground': '#dcd7c9',
        'editorWidget.background': '#fbfaf6',
        'editorWidget.border': '#dcd7c9',
        'editorSuggestWidget.background': '#fbfaf6',
        'editorSuggestWidget.border': '#dcd7c9',
    },
})

monaco.editor.defineTheme('paper-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
        'editor.background': '#1b1a15',
        'editor.foreground': '#ece7da',
        'editorGutter.background': '#1b1a15',
        'editor.lineHighlightBackground': '#24221c',
        'editorLineNumber.foreground': '#5c574b',
        'editorLineNumber.activeForeground': '#a39c8b',
    },
})
