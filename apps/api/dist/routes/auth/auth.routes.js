import { createRoute, z } from '@hono/zod-openapi';
import { HttpStatusCodes, createErrorSchema, createMessageObjectSchema, jsonContent, jsonContentRequired, } from '../../lib/openapi.js';
import { selectUserSchema } from '../../db/schema.js';
const tags = ['Auth'];
/** 从 cookieAuth 中间件拿到的用户 */
const userResponseSchema = selectUserSchema.extend({
    /**
     * 前端 /auth/me 期望的字段名是 name,不是 username
     * (旧 Nest 的 auth.controller.ts 里显式做了 username -> name 的映射)
     */
    name: z.string().nullable(),
});
const loginBodySchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});
const registerBodySchema = z.object({
    email: z.string().email(),
    // 只影响新注册;存量 hash 不动,老密码仍可登录
    password: z.string().min(8, '密码至少 8 位'),
    name: z.string().min(1),
});
const loginResponseSchema = z.object({ user: userResponseSchema });
const unauthorizedSchema = createMessageObjectSchema(HttpStatusCodes.UNAUTHORIZED.toString());
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
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(loginBodySchema), '参数校验失败'),
    },
});
export const register = createRoute({
    method: 'post',
    path: '/auth/register',
    tags,
    request: {
        body: jsonContentRequired(registerBodySchema, '注册信息'),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(userResponseSchema, '注册成功'),
        [HttpStatusCodes.FORBIDDEN]: jsonContent(createMessageObjectSchema('Registration is disabled'), '注册已关闭'),
        [HttpStatusCodes.CONFLICT]: jsonContent(createMessageObjectSchema('User already exists'), '邮箱已被注册'),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(registerBodySchema), '参数校验失败'),
    },
});
export const logout = createRoute({
    method: 'post',
    path: '/auth/logout',
    tags,
    responses: {
        [HttpStatusCodes.OK]: jsonContent(createMessageObjectSchema('Logged out successfully'), '已清除 Cookie'),
    },
});
export const me = createRoute({
    method: 'get',
    path: '/auth/me',
    tags,
    responses: {
        [HttpStatusCodes.OK]: jsonContent(userResponseSchema, '当前登录用户'),
        [HttpStatusCodes.UNAUTHORIZED]: jsonContent(unauthorizedSchema, '未登录或已过期'),
    },
});
