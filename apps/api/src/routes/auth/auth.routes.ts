import { createRoute, z } from '@hono/zod-openapi'
import {
    HttpStatusCodes,
    createErrorSchema,
    createMessageObjectSchema,
    jsonContent,
    jsonContentRequired,
} from '../../lib/openapi.js'
import { selectUserSchema } from '../../db/schema.js'

const tags = ['Auth']

/** 从 cookieAuth 中间件拿到的用户;createdIpHash 是内部反滥用数据,不外露 */
const userResponseSchema = selectUserSchema
    .omit({ createdIpHash: true })
    .extend({
        /**
         * 前端 /auth/me 期望的字段名是 name,不是 username
         * (旧 Nest 的 auth.controller.ts 里显式做了 username -> name 的映射)
         */
        name: z.string().nullable(),
    })

const loginBodySchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
})

const registerBodySchema = z.object({
    email: z.string().email(),
    // 只影响新注册;存量 hash 不动,老密码仍可登录
    password: z.string().min(8, '密码至少 8 位'),
    name: z.string().min(1),
    // CF Turnstile token:服务端 SECRET 配置后必验(docs/abuse-defense-plan.md §3)
    turnstileToken: z.string().optional(),
    // 国内加载不到 Turnstile 时的本地兜底(GET /auth/challenge 下发)
    challenge: z
        .object({
            id: z.string().min(1),
            answer: z.string().min(1),
            sig: z.string().min(1),
            expiresAt: z.coerce.number(),
        })
        .optional(),
})

const loginResponseSchema = z.object({ user: userResponseSchema })

const unauthorizedSchema = createMessageObjectSchema(HttpStatusCodes.UNAUTHORIZED.toString())

export const login = createRoute({
    method: 'post',
    path: '/auth/login',
    tags,
    request: {
        body: jsonContentRequired(loginBodySchema, '邮箱 + 密码'),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(loginResponseSchema, '登录成功,JWT 已写入 HttpOnly Cookie'),
        [HttpStatusCodes.UNAUTHORIZED]: jsonContent(unauthorizedSchema, '邮箱或密码错误'),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
            createErrorSchema(loginBodySchema),
            '参数校验失败',
        ),
    },
})

export const register = createRoute({
    method: 'post',
    path: '/auth/register',
    tags,
    request: {
        body: jsonContentRequired(registerBodySchema, '注册信息'),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(userResponseSchema, '注册成功'),
        [HttpStatusCodes.FORBIDDEN]: jsonContent(
            createMessageObjectSchema('Registration is disabled'),
            '注册已关闭',
        ),
        [HttpStatusCodes.CONFLICT]: jsonContent(
            createMessageObjectSchema('User already exists'),
            '邮箱已被注册',
        ),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
            createErrorSchema(registerBodySchema),
            '参数校验失败',
        ),
    },
})

export const humanChallenge = createRoute({
    method: 'get',
    path: '/auth/challenge',
    tags,
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({
                id: z.string(),
                question: z.string(),
                sig: z.string(),
                expiresAt: z.number(),
            }),
            '本地人机验证题(无法加载 Turnstile 时使用)',
        ),
    },
})

const verifyEmailBodySchema = z.object({
    // 前端从 ?token= 取出来原样回传
    token: z.string().min(10, 'token 不合法'),
})

const resendVerificationBodySchema = z.object({
    email: z.string().email(),
})

export const verifyEmail = createRoute({
    method: 'post',
    path: '/auth/email/verify',
    tags,
    request: {
        body: jsonContentRequired(verifyEmailBodySchema, '邮件里的验证 token'),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({
                user: userResponseSchema,
                // true = 之前已经验证过(重复点链接 / 刷新页面),前端可以当成功处理
                alreadyVerified: z.boolean(),
            }),
            '验证成功',
        ),
        [HttpStatusCodes.BAD_REQUEST]: jsonContent(
            createMessageObjectSchema('Invalid or expired token'),
            'token 无效或已过期',
        ),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
            createErrorSchema(verifyEmailBodySchema),
            '参数校验失败',
        ),
    },
})

export const resendVerification = createRoute({
    method: 'post',
    path: '/auth/email/resend',
    tags,
    request: {
        body: jsonContentRequired(resendVerificationBodySchema, '邮箱'),
    },
    responses: {
        // 无论邮箱是否存在、是否已验证,都返回同一句话:
        // 否则这个接口就成了「查邮箱是否注册过」的探测器
        [HttpStatusCodes.OK]: jsonContent(
            createMessageObjectSchema('如果该邮箱需要验证,我们已重新发送'),
            '已受理(不透露账号是否存在)',
        ),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
            createErrorSchema(resendVerificationBodySchema),
            '参数校验失败',
        ),
    },
})

export const logout = createRoute({
    method: 'post',
    path: '/auth/logout',
    tags,
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            createMessageObjectSchema('Logged out successfully'),
            '已清除 Cookie',
        ),
    },
})

export const me = createRoute({
    method: 'get',
    path: '/auth/me',
    tags,
    responses: {
        [HttpStatusCodes.OK]: jsonContent(userResponseSchema, '当前登录用户'),
        [HttpStatusCodes.UNAUTHORIZED]: jsonContent(unauthorizedSchema, '未登录或已过期'),
    },
})
// ============================================================
// handler 用的类型别名 —— 与旧 tasks.routes.ts 的写法一致
// ============================================================

export type LoginRoute = typeof login
export type RegisterRoute = typeof register
export type HumanChallengeRoute = typeof humanChallenge
export type VerifyEmailRoute = typeof verifyEmail
export type ResendVerificationRoute = typeof resendVerification
export type LogoutRoute = typeof logout
export type MeRoute = typeof me
