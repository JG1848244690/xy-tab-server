/**
 * Auth 路由定义
 *
 *   POST /sync/auth/google   公开,扩展用 chrome.identity 拿 userinfo 后转发
 *                            后端不做任何 Google API 调用,纯信物模式
 *   POST /sync/auth/logout   Bearer,删除自己的 session
 *   GET  /sync/auth/me       Bearer,查当前用户
 */

import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers';

const tags = ['Sync Auth'];

// ===== POST /sync/auth/google =====
// 扩展侧流程:chrome.identity.getAuthToken 拿 token → 扩展自己 fetch
// https://www.googleapis.com/oauth2/v3/userinfo → 把 userinfo JSON 直接转发过来
// 后端只校验 email_verified === true,然后 upsert users + 发 sessionToken
// 不调任何 Google API,适合 NAT 网关屏蔽 HTTPS 出站的部署环境
export const googleLogin = createRoute({
    path: '/sync/auth/google',
    method: 'post',
    tags,
    request: {
        body: jsonContentRequired(
            z.object({
                googleSub: z.string().min(1),
                email: z.string().email(),
                emailVerified: z.boolean(),
                name: z.string().nullable().optional(),
                picture: z.string().url().nullable().optional(),
            }),
            'Google userinfo JSON(扩展用 chrome.identity.getAuthToken 拿到)',
        ),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({
                sessionToken: z.string(),
                user: z.object({
                    id: z.string(),
                    email: z.string(),
                    name: z.string().nullable(),
                    picture: z.string().nullable(),
                    googleSub: z.string(),
                }),
            }),
            'session token + user',
        ),
        [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
            z.object({ error: z.string() }),
            'email not verified or invalid payload',
        ),
    },
});

// ===== POST /sync/auth/logout =====
export const logout = createRoute({
    path: '/sync/auth/logout',
    method: 'post',
    tags,
    security: [{ Bearer: [] }],
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({ success: z.boolean() }),
            'session deleted',
        ),
        [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
            z.object({ error: z.string() }),
            'invalid token',
        ),
    },
});

// ===== GET /sync/auth/me =====
export const me = createRoute({
    path: '/sync/auth/me',
    method: 'get',
    tags,
    security: [{ Bearer: [] }],
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({
                id: z.string(),
                email: z.string(),
                name: z.string().nullable(),
                picture: z.string().nullable(),
                googleSub: z.string(),
            }),
            'current user',
        ),
        [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
            z.object({ error: z.string() }),
            'invalid token',
        ),
    },
});

export type GoogleLoginRoute = typeof googleLogin;
export type LogoutRoute = typeof logout;
export type MeRoute = typeof me;
