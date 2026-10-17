/**
 * Cookie 鉴权中间件
 *
 * 为什么是 Cookie 而不是 Bearer:
 * 旧 hlsEdu 前端的 axios 配了 withCredentials: true,登录态存在 HttpOnly Cookie
 * `Authentication` 里,服务端渲染 (web-front/src/app/layout.tsx) 也手工把
 * 这个 Cookie 转发给 /auth/me。保持一致,前端一行都不用改。
 *
 * 用法:
 *   app.use('/questions/*', cookieAuth())   // 整棵子树
 *   或 onRoute(routes.x, cookieAuth())      // 单个路由
 *
 * 通过后往 c.set('userId', ...) 注入。
 */

import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import { jwtVerify } from 'jose'
import { eq } from 'drizzle-orm'
import db from '../db/index.js'
import { users } from '../db/schema.js'
import env from '../env.js'
import type { AppBindings } from '../lib/types.js'
import { errorBody } from '../lib/errors.js'

const secret = new TextEncoder().encode(env.JWT_SECRET)

/** 校验 Cookie 里的 JWT 并把 userId / email 注入 context */
export const cookieAuth = () =>
    createMiddleware<AppBindings>(async (c, next) => {
        const token = getCookie(c, env.AUTH_COOKIE_NAME)
        if (!token) {
            return c.json(errorBody('Unauthorized', 'UNAUTHORIZED'), 401)
        }

        let userId: string
        try {
            const { payload } = await jwtVerify(token, secret)
            if (typeof payload.sub !== 'string') {
                return c.json(errorBody('Unauthorized', 'UNAUTHORIZED'), 401)
            }
            userId = payload.sub
        } catch {
            // token 过期 / 被篡改 / 密钥不对,一律当未登录。
            // 前端 axios 响应拦截器收到 401 会清 store 并跳 /login
            return c.json(errorBody('Unauthorized', 'UNAUTHORIZED'), 401)
        }

        // 确认用户仍存在(token 签发后账号可能已被删)
        const [user] = await db
            .select({ id: users.id, email: users.email })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1)

        if (!user) {
            return c.json(errorBody('Unauthorized', 'UNAUTHORIZED'), 401)
        }

        c.set('userId', user.id)
        c.set('userEmail', user.email)
        await next()
    })