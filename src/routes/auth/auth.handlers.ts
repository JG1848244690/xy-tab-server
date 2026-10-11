import { eq } from 'drizzle-orm'
import type { LoginRoute, RegisterRoute, LogoutRoute, MeRoute } from './auth.routes.js'
import type { AppRouteHandler } from '../../lib/types.js'
import db from '../../db/index.js'
import { users } from '../../db/schema.js'
import { HttpStatusCodes } from '../../lib/openapi.js'
import {
    clearAuthCookie,
    hashPassword,
    setAuthCookie,
    signToken,
    verifyPassword,
} from '../../lib/auth.js'

/** users 行 -> 前端期望的形状(username 映射成 name) */
function toUserResponse(row: typeof users.$inferSelect) {
    // selectUserSchema 是 omit 掉 password 的,不 parse 全行,否则 zod 会因
    // 多出的 password 键报错;这里手动挑字段
    return {
        id: row.id,
        email: row.email,
        username: row.username,
        avatarPath: row.avatarPath,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        name: row.username,
    }
}

export const login: AppRouteHandler<LoginRoute> = async (c) => {
    const { email, password } = c.req.valid('json')

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    // 邮箱不存在和密码错误返回同一个 401,不泄露账号是否存在
    if (!user || !(await verifyPassword(password, user.password))) {
        return c.json({ message: 'Invalid credentials' }, HttpStatusCodes.UNAUTHORIZED)
    }

    const token = await signToken(user.id, user.email)
    setAuthCookie(c, token)

    return c.json({ user: toUserResponse(user) }, HttpStatusCodes.OK)
}

export const register: AppRouteHandler<RegisterRoute> = async (c) => {
    const { email, password, name } = c.req.valid('json')

    const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1)
    if (existing) {
        return c.json({ message: 'User already exists' }, HttpStatusCodes.CONFLICT)
    }

    const [created] = await db
        .insert(users)
        .values({ email, password: await hashPassword(password), username: name })
        .returning()

    // 旧 Nest 的 register 不下发登录态,前端注册后仍需走一次 login,保持一致
    return c.json(toUserResponse(created), HttpStatusCodes.OK)
}

export const logout: AppRouteHandler<LogoutRoute> = (c) => {
    clearAuthCookie(c)
    return c.json({ message: 'Logged out successfully' }, HttpStatusCodes.OK)
}

/** userId 由 app.ts 里挂的 cookieAuth 中间件注入,没走到这里的都是已登录 */
export const me: AppRouteHandler<MeRoute> = async (c) => {
    const userId = c.get('userId')!
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    // 中间件已确认用户存在,这里仍兜一层,避免删号瞬间返 500
    if (!user) {
        return c.json({ message: 'User not found' }, HttpStatusCodes.UNAUTHORIZED)
    }
    return c.json(toUserResponse(user), HttpStatusCodes.OK)
}