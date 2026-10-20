/**
 * admin 权限中间件(2026-10-20)
 *
 * 用途:审核工作台、人工裁决、发布等后台动作只允许 admin。
 *
 * 为什么 role 不进 JWT:JWT 一签发就固定了角色,改权限要等 token 过期才生效。
 * 这里每次请求都从 cookieAuth 查库拿到的 role 判定 —— 改角色立刻生效。
 *
 * 用法:
 *   app.use('/review/queue', cookieAuth(), requireAdmin())
 *   或在 handler 里用 adminOnly(c) 助手(参数路由场景,见 review.handlers.ts)
 */
import { createMiddleware } from 'hono/factory'
import type { AppBindings } from '../lib/types.js'
import { errorBody } from '../lib/errors.js'

/** 路径级中间件 */
export const requireAdmin = () =>
    createMiddleware<AppBindings>(async (c, next) => {
        if (c.get('userRole') !== 'admin') {
            return c.json(errorBody('Forbidden', 'FORBIDDEN'), 403)
        }
        await next()
    })

/**
 * handler 级助手(参数路由用):
 * `/review/:id/human` 这种路由没法用路径级中间件(会误伤同前缀的 trigger),
 * 在 handler 开头显式调用。
 * 返回 true = 有权限;false = 已写过 403 响应。
 */
export function adminOnly(c: { get: (k: 'userRole') => 'user' | 'admin' | undefined }): boolean {
    return c.get('userRole') === 'admin'
}
