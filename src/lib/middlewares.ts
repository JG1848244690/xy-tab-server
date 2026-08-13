/**
 * middlewares.ts —— 替代 stoker/middlewares
 *
 * 提供三个最常用的 Hono 中间件/handler:
 *   - serveEmojiFavicon(emoji):在 GET /favicon.ico 时返 emoji 文本
 *   - notFound:404 兜底
 *   - onError:错误统一处理
 *
 * 行为跟 stoker 一致,直接 inline 过来不依赖 stoker。
 */

import type { Context, ErrorHandler, MiddlewareHandler } from 'hono'

export const serveEmojiFavicon =
    (emoji: string): MiddlewareHandler =>
    async (c, next) => {
        if (c.req.path === '/favicon.ico') {
            return c.body(emoji)
        }
        await next()
    }

export const notFound = (c: Context) =>
    c.json({ error: 'not found' }, 404) as Response

export const onError: ErrorHandler = (err, c) => {
    console.error('[onError]', err)
    return c.json({ error: err.message }, 500) as Response
}