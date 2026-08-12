/**
 * Auth 路由定义
 *
 *   POST /sync/auth/google   公开,扩展用 launchWebAuthFlow 拿到 id_token,
 *                            解码 payload 拿 email 后只发 email 给后端
 *                            后端完全不调 Google、不验签,信任扩展发的 email
 *                            ⚠️ 任何能 POST 到这个端点 + 知道 email 的人
 *                            都能拿到对应用户的 sessionToken —— 仅适合
 *                            个人/小范围使用,生产环境必须加签名验证
 *   POST /sync/auth/logout   Bearer,删除自己的 session
 *   GET  /sync/auth/me       Bearer,查当前用户
 */

import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers';

const tags = ['Sync Auth'];

// ===== POST /sync/auth/google =====
// 简化版信物模式:扩展用 launchWebAuthFlow 拿 id_token,解 payload 拿 email,
// 只把 email POST 给后端。后端用 email 派生 userId,upsert users,发 sessionToken。
// 不调任何 Google API,不验证 id_token 签名,适合 NAT 网关/防火墙屏蔽 HTTPS
// 出站 + 不在意攻击者伪造 email 拿别人 sessionToken 的部署。
export const googleLogin = createRoute({
    path: '/sync/auth/google',
    method: 'post',
    tags,
    request: {
        body: jsonContentRequired(
            z.object({
                email: z.string().email(),
                // name / picture 扩展可选填,后端会存但不强求
                name: z.string().nullable().optional(),
                picture: z.string().url().nullable().optional(),
            }),
            '扩展从 id_token 解码的 email(后端不验签,信任扩展发的值)',
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
        [HttpStatusCodes.BAD_REQUEST]: jsonContent(
            z.object({ error: z.string() }),
            'invalid email',
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
