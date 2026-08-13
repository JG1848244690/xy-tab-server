/**
 * Auth 路由定义
 *
 *   POST /sync/auth/google   公开,扩展用 launchWebAuthFlow 拿 id_token,
 *                            后端用 jose + 本地 JWKS 验签后再颁发 sessionToken。
 *                            服务器零 HTTPS 出站(JWKS 静态 hardcode + CI 每月更新)
 *   POST /sync/auth/logout   Bearer,删除自己的 session
 *   GET  /sync/auth/me       Bearer,查当前用户
 */

import { createRoute, z } from '@hono/zod-openapi';
import { HttpStatusCodes, jsonContent, jsonContentRequired } from '../../lib/openapi.js';

const tags = ['Sync Auth'];

// ===== POST /sync/auth/google =====
// 扩展侧流程:launchWebAuthFlow 拿 id_token(隐式流,response_type=id_token)→
// POST {idToken} 给后端 → 后端用 jose + 本地 JWKS 验签(RS256,校验 iss/aud/exp)
// → 从 payload 拿 sub/email/name/picture → upsert users → 发 sessionToken。
// 后端零 HTTPS 出站,适合 NAT 网关屏蔽出站的部署。
export const googleLogin = createRoute({
    path: '/sync/auth/google',
    method: 'post',
    tags,
    request: {
        body: jsonContentRequired(
            z.object({
                idToken: z.string().min(1),
                // nonce 扩展生成时附带,后端二次校验防 replay(可选)
                nonce: z.string().uuid().optional(),
            }),
            'Google id_token from launchWebAuthFlow (隐式流 response_type=id_token)',
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
            'id_token 验签失败 / 过期 / aud 不匹配 / email 未验证',
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
