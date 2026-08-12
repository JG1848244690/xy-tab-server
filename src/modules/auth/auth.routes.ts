/**
 * Auth 路由定义
 *
 *   POST /sync/auth/google   公开,用 code 换 sessionToken
 *   POST /sync/auth/logout   Bearer,删除自己的 session
 *   GET  /sync/auth/me       Bearer,查当前用户
 */

import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers';

const tags = ['Sync Auth'];

// ===== POST /sync/auth/google =====
export const googleLogin = createRoute({
    path: '/sync/auth/google',
    method: 'post',
    tags,
    request: {
        body: jsonContentRequired(
            z.object({
                code: z.string().min(1),
                redirectUri: z.string().url(),
            }),
            'authorization code from Google + matching redirect_uri',
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
            'invalid code or redirect_uri',
        ),
        [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
            z.object({ error: z.string() }),
            'Google rejected the code',
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
