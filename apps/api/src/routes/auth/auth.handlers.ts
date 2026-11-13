import { and, count, eq, gte } from 'drizzle-orm'
import type {
    LoginRoute,
    RegisterRoute,
    LogoutRoute,
    MeRoute,
    HumanChallengeRoute,
    VerifyEmailRoute,
    ResendVerificationRoute,
} from './auth.routes.js'
import type { AppRouteHandler } from '../../lib/types.js'
import db from '../../db/index.js'
import { users } from '../../db/schema.js'
import { HttpStatusCodes } from '../../lib/openapi.js'
import { errorBody } from '../../lib/errors.js'
import { clientIp, ipHashOf } from '../../lib/client-ip.js'
import { verifyTurnstile } from '../../lib/turnstile.js'
import { createChallenge, verifyChallenge } from '../../lib/human-challenge.js'
import { createEmailVerifyToken, verifyEmailVerifyToken } from '../../lib/email-token.js'
import { sendVerificationEmail } from '../../lib/mailer.js'
import { REGISTER_IP_DAILY_LIMIT, REGISTER_IP_TOTAL_LIMIT } from '../../lib/constants.js'
import env from '../../env.js'
import {
    clearAuthCookie,
    hashPassword,
    setAuthCookie,
    signToken,
    verifyPassword,
} from '../../lib/auth.js'

/**
 * 邮箱不存在时也执行一次同成本的 bcrypt compare,抹平两种失败路径的耗时差,
 * 防止通过响应时间探测"这个邮箱有没有注册过"。
 * 模块加载时算一次 dummy hash,后续只做 compare。
 */
const DUMMY_HASH_PROMISE = hashPassword('timing-equalization-dummy')

/** users 行 -> 前端期望的形状(username 映射成 name) */
function toUserResponse(row: typeof users.$inferSelect) {
    // selectUserSchema 是 omit 掉 password 的,不 parse 全行,否则 zod 会因
    // 多出的 password 键报错;这里手动挑字段
    return {
        id: row.id,
        email: row.email,
        username: row.username,
        avatarPath: row.avatarPath,
        // role:前端拿来决定「审核工作台」入口显隐;权限边界在后端
        role: row.role,
        // null = 邮箱未验证;前端用它决定是否提示「去验证邮箱」
        emailVerifiedAt: row.emailVerifiedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        name: row.username,
    }
}

export const login: AppRouteHandler<LoginRoute> = async (c) => {
    const { email, password } = c.req.valid('json')

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    // 邮箱不存在和密码错误返回同一个 401、走同样耗时的 bcrypt compare,不泄露账号是否存在
    if (user) {
        if (!(await verifyPassword(password, user.password))) {
            return c.json({ message: 'Invalid credentials' }, HttpStatusCodes.UNAUTHORIZED)
        }
    } else {
        await verifyPassword(password, await DUMMY_HASH_PROMISE)
        return c.json({ message: 'Invalid credentials' }, HttpStatusCodes.UNAUTHORIZED)
    }

    const token = await signToken(user.id, user.email)
    setAuthCookie(c, token)

    return c.json({ user: toUserResponse(user) }, HttpStatusCodes.OK)
}

export const register: AppRouteHandler<RegisterRoute> = async (c) => {
    // 注册开关:封口时服务器 .env 里 REGISTRATION_ENABLED=false 重启即可
    if (env.REGISTRATION_ENABLED === 'false') {
        return c.json(
            { message: 'Registration is disabled' },
            HttpStatusCodes.FORBIDDEN,
        )
    }

    const { email, password, name, turnstileToken, challenge } = c.req.valid('json')
    const ip = clientIp(c)

    /**
     * 真人验证,两条路任选其一:
     *  1. CF Turnstile(海外/能访问 challenges.cloudflare.com)
     *  2. 本地 HMAC 算术题(国内加载不到 Turnstile 时的兜底)
     * 都失败才拒绝。IP 维度的日/总量上限不受影响。
     */
    const turnstileOk = await verifyTurnstile(turnstileToken, ip)
    const challengeOk = turnstileOk ? false : verifyChallenge(challenge)
    if (!turnstileOk && !challengeOk) {
        return c.json(errorBody('真人验证未通过,请重试', 'TURNSTILE_FAILED'), HttpStatusCodes.FORBIDDEN)
    }

    // 同 IP 注册硬顶:24h 内 ≥2 个 或 累计 ≥5 个 → 拒绝(防多号,不封 IP)
    // 查询容忍 mock 环境的空结果(?..)
    const ipHash = ipHashOf(ip)
    const since24h = new Date(Date.now() - 24 * 3600_000)
    const [daily] = await db
        .select({ n: count() })
        .from(users)
        .where(and(eq(users.createdIpHash, ipHash), gte(users.createdAt, since24h)))
    if (Number(daily?.n ?? 0) >= REGISTER_IP_DAILY_LIMIT) {
        return c.json(
            errorBody('该网络注册过于频繁,请明天再试', 'REGISTER_LIMIT'),
            HttpStatusCodes.FORBIDDEN,
        )
    }
    const [total] = await db
        .select({ n: count() })
        .from(users)
        .where(eq(users.createdIpHash, ipHash))
    if (Number(total?.n ?? 0) >= REGISTER_IP_TOTAL_LIMIT) {
        return c.json(
            errorBody('该网络注册账号数已达上限', 'REGISTER_LIMIT'),
            HttpStatusCodes.FORBIDDEN,
        )
    }

    // 不再做先查后插:并发注册同一邮箱时两边都能过查重,后到者撞唯一索引
    // 变 500(还把 PG 错误信息泄露给客户端)。onConflictDoNothing 让数据库
    // 一锤定音,returning 为空即冲突 → 409
    const [created] = await db
        .insert(users)
        .values({
            email,
            password: await hashPassword(password),
            username: name,
            createdIpHash: ipHash,
        })
        .onConflictDoNothing({ target: users.email })
        .returning()

    if (!created) {
        return c.json(errorBody('User already exists', 'CONFLICT'), HttpStatusCodes.CONFLICT)
    }

    /**
     * 发验证邮件:fire-and-forget。
     *
     * 不 await 的理由:邮件服务超时(哪怕 10s)不该让用户看到「注册失败」——
     * 账号其实已经建好了,用户重试反而会撞 409。发信失败只是「没收到邮件」,
     * 用户可以点「重新发送」,这是可恢复的。
     */
    const { token } = createEmailVerifyToken(created.id, created.email)
    void sendVerificationEmail({
        to: created.email,
        name: created.username,
        token,
    }).catch((err) => {
        // 只记日志,不影响注册结果
        console.error('[mail] 发送验证邮件失败', created.email, err)
    })

    // 旧 Nest 的 register 不下发登录态,前端注册后仍需走一次 login,保持一致
    return c.json(toUserResponse(created), HttpStatusCodes.OK)
}

export const humanChallenge: AppRouteHandler<HumanChallengeRoute> = (c) => {
    return c.json(createChallenge(), HttpStatusCodes.OK)
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

/**
 * 点邮件链接 → 前端 /verify-email 页面把 token POST 过来。
 *
 * 为什么不在后端直接返回一个 HTML 页面:
 *   站点是 SPA,验证结果需要落到前端的界面和登录态上;
 *   后端只做「验签 + 写库 + 返回用户」,展示归前端。
 */
export const verifyEmail: AppRouteHandler<VerifyEmailRoute> = async (c) => {
    const { token } = c.req.valid('json')

    const payload = verifyEmailVerifyToken(token)
    if (!payload) {
        // 签名不对 / 过期 / 格式坏,统一一个错误,不告诉攻击者具体哪一步错了
        return c.json(
            { message: 'Invalid or expired token' },
            HttpStatusCodes.BAD_REQUEST,
        )
    }

    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1)
    if (!user) {
        return c.json({ message: 'Invalid or expired token' }, HttpStatusCodes.BAD_REQUEST)
    }

    // token 里绑了当初的邮箱:用户改过邮箱后,旧链接必须失效
    if (user.email !== payload.email) {
        return c.json({ message: 'Invalid or expired token' }, HttpStatusCodes.BAD_REQUEST)
    }

    // 重复点链接(或刷新页面):幂等返回,前端按成功处理
    if (user.emailVerifiedAt) {
        return c.json(
            { user: toUserResponse(user), alreadyVerified: true },
            HttpStatusCodes.OK,
        )
    }

    const [updated] = await db
        .update(users)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning()

    return c.json(
        { user: toUserResponse(updated ?? user), alreadyVerified: false },
        HttpStatusCodes.OK,
    )
}

/**
 * 每邮箱 60 秒最多重发一次(进程内 Map)。
 *
 * 说明:这是「单实例」假设下的轻量做法,重启即清空。
 * 多副本部署时应该换成 Redis 或数据库计数 —— 这里保留 Map 是为了
 * 让你先看清「为什么要做冷却」,而不是一上来就拉一套中间件。
 */
const lastSentAt = new Map<string, number>()
const RESEND_COOLDOWN_MS = 60_000

export const resendVerification: AppRouteHandler<ResendVerificationRoute> = async (c) => {
    const { email } = c.req.valid('json')
    const generic = { message: '如果该邮箱需要验证,我们已重新发送' }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)

    // 不存在的邮箱、已验证的邮箱:都返回同一句话,避免变成账号探测器
    if (!user || user.emailVerifiedAt) {
        return c.json(generic, HttpStatusCodes.OK)
    }

    const now = Date.now()
    const last = lastSentAt.get(email) ?? 0
    if (now - last < RESEND_COOLDOWN_MS) {
        return c.json(generic, HttpStatusCodes.OK)
    }
    lastSentAt.set(email, now)

    const { token } = createEmailVerifyToken(user.id, user.email)
    void sendVerificationEmail({ to: user.email, name: user.username, token }).catch((err) => {
        console.error('[mail] 重发验证邮件失败', user.email, err)
    })

    return c.json(generic, HttpStatusCodes.OK)
}