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
