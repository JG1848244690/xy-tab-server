/**
 * 鉴权相关的纯函数:密码哈希 + JWT 签发/校验 + Cookie 读写
 *
 * 放在 lib/ 而不是 middlewares/,是为了让 handlers 能直接 import 而不产生循环依赖。
 */

import { hash, compare } from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import env from '../env.js'

const secret = new TextEncoder().encode(env.JWT_SECRET)

/** bcrypt cost。旧 Nest 项目用的是 10,保持一致以便搬存量数据时旧密码仍能登录 */
const BCRYPT_ROUNDS = 10

export const hashPassword = (plain: string) => hash(plain, BCRYPT_ROUNDS)

export const verifyPassword = (plain: string, hashed: string) => compare(plain, hashed)

// ============================================================
// JWT
// ============================================================

/** 签发登录 token,payload 与旧 Nest 的 {email, sub} 保持一致 */
export const signToken = (userId: string, email: string) =>
    new SignJWT({ email })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime(`${env.AUTH_COOKIE_MAX_AGE}s`)
        .sign(secret)

/** 校验 token 并取出 userId,失败返回 null */
export async function verifyToken(token: string): Promise<string | null> {
    try {
        const { payload } = await jwtVerify(token, secret)
        return typeof payload.sub === 'string' ? payload.sub : null
    } catch {
        return null
    }
}

// ============================================================
// Cookie
// ============================================================

/**
 * 写登录 Cookie。
 *
 * secure 只在生产开 —— 开发走 http://localhost,开了浏览器就不发了。
 * sameSite: 'lax' 是旧 Nest 版的选择:挡住大部分 CSRF(跨站 POST 不带 Cookie),
 * 同时不影响同站导航。
 */
export function setAuthCookie(c: Context, token: string) {
    setCookie(c, env.AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: env.AUTH_COOKIE_MAX_AGE,
    })
}

export function clearAuthCookie(c: Context) {
    deleteCookie(c, env.AUTH_COOKIE_NAME, { path: '/' })
}

export const readAuthCookie = (c: Context) => getCookie(c, env.AUTH_COOKIE_NAME)