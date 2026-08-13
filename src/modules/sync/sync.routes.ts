/**
 * Sync 路由(全部需要 Bearer token)
 *
 *   GET  /sync/bookmarks   拉书签快照
 *   PUT  /sync/bookmarks   推书签快照(乐观锁)
 *   GET  /sync/sessions    拉 tab session 快照
 *   PUT  /sync/sessions    推 tab session 快照(乐观锁)
 *
 * payload 用 z.any() 透传,因为插件侧的 ExportData 类型在前端
 *  后端只作为 byte bucket,版本号管理冲突
 *  注意:不能用 z.unknown(),@hono/zod-openapi 0.19 推 TypedResponse 时
 *  unknown 会让 _data 变 never,触发 typecheck 报错
 */

import { createRoute, z } from '@hono/zod-openapi';
import { HttpStatusCodes, jsonContent, jsonContentRequired } from '../../lib/openapi.js';

const tags = ['Sync'];

// ===== GET /sync/bookmarks =====
export const getBookmarks = createRoute({
    path: '/sync/bookmarks',
    method: 'get',
    tags,
    security: [{ Bearer: [] }],
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({
                payload: z.any(),
                version: z.number(),
                updatedAt: z.string(),
            }),
            'bookmark snapshot',
        ),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(
            z.object({ error: z.string() }),
            'no snapshot yet',
        ),
        [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
            z.object({ error: z.string() }),
            'invalid token',
        ),
    },
});

// ===== PUT /sync/bookmarks =====
export const putBookmarks = createRoute({
    path: '/sync/bookmarks',
    method: 'put',
    tags,
    security: [{ Bearer: [] }],
    request: {
        body: jsonContentRequired(
            z.object({
                payload: z.any(),
                expectedVersion: z.number().int().nonnegative(),
            }),
            'bookmark snapshot + expected version',
        ),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({
                payload: z.any(),
                version: z.number(),
                updatedAt: z.string(),
            }),
            'updated',
        ),
        [HttpStatusCodes.CONFLICT]: jsonContent(
            z.object({
                error: z.string(),
                currentVersion: z.number(),
                currentPayload: z.any().nullable(),
            }),
            'version mismatch',
        ),
        [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
            z.object({ error: z.string() }),
            'invalid token',
        ),
    },
});

// ===== GET /sync/sessions =====
export const getSessions = createRoute({
    path: '/sync/sessions',
    method: 'get',
    tags,
    security: [{ Bearer: [] }],
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({
                payload: z.any(),
                version: z.number(),
                updatedAt: z.string(),
            }),
            'tab sessions snapshot',
        ),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(
            z.object({ error: z.string() }),
            'no snapshot yet',
        ),
        [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
            z.object({ error: z.string() }),
            'invalid token',
        ),
    },
});

// ===== PUT /sync/sessions =====
export const putSessions = createRoute({
    path: '/sync/sessions',
    method: 'put',
    tags,
    security: [{ Bearer: [] }],
    request: {
        body: jsonContentRequired(
            z.object({
                payload: z.any(),
                expectedVersion: z.number().int().nonnegative(),
            }),
            'tab sessions snapshot + expected version',
        ),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({
                payload: z.any(),
                version: z.number(),
                updatedAt: z.string(),
            }),
            'updated',
        ),
        [HttpStatusCodes.CONFLICT]: jsonContent(
            z.object({
                error: z.string(),
                currentVersion: z.number(),
                currentPayload: z.any().nullable(),
            }),
            'version mismatch',
        ),
        [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
            z.object({ error: z.string() }),
            'invalid token',
        ),
    },
});

export type GetBookmarksRoute = typeof getBookmarks;
export type PutBookmarksRoute = typeof putBookmarks;
export type GetSessionsRoute = typeof getSessions;
export type PutSessionsRoute = typeof putSessions;
