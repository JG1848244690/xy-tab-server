/**
 * Sync 路由(全部需要 Bearer token)
 *
 *   GET  /sync/bookmarks   拉书签快照
 *   PUT  /sync/bookmarks   推书签快照(乐观锁)
 *   GET  /sync/sessions    拉 tab session 快照
 *   PUT  /sync/sessions    推 tab session 快照(乐观锁)
 *
 * payload 用 JsonValueSchema 透传,因为插件侧的 ExportData 类型在前端
 *  后端只作为 byte bucket,版本号管理冲突
 *  JsonValueSchema 是 "任意 JSON 值" 的真正 schema,比 z.any() 严格
 *  (运行时真校验形状),比 z.unknown() 跟 hono 0.19 兼容(避免 _data 变 never)
 */

import { createRoute, z } from '@hono/zod-openapi';
import { HttpStatusCodes, jsonContent, jsonContentRequired } from '../../lib/openapi.js';

const tags = ['Sync'];

// ===== GET /sync/bookmarks =====
// 响应侧不写 schema —— payload 是原样回放已存数据,handler 直接 c.json(row),
// 避免 JsonValueSchema 递归类型在 TypedResponse 推导时爆栈(TS2589)
export const getBookmarks = createRoute({
    path: '/sync/bookmarks',
    method: 'get',
    tags,
    security: [{ Bearer: [] }],
    responses: {
        [HttpStatusCodes.OK]: {
            description: 'bookmark snapshot (payload 为任意 JSON 值,见 PUT body schema)',
        },
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
// request body payload 用 z.unknown() —— 不在 route 端用 JsonValueSchema(递归
// 类型会让 AppRouteHandler 推导爆栈 TS2589),handler 端用 JsonValueSchema.parse
// 显式校验。OpenAPI spec 仍然提示 payload 是任意 JSON,但不强推类型。
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
            'bookmark snapshot + expected version (payload 为任意 JSON 值,handler 端用 JsonValueSchema 校验)',
        ),
    },
    responses: {
        [HttpStatusCodes.OK]: {
            description: 'updated (payload 为任意 JSON 值)',
        },
        [HttpStatusCodes.CONFLICT]: {
            description: 'version mismatch (currentPayload 任意 JSON 值,nullable)',
        },
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
        [HttpStatusCodes.OK]: {
            description: 'tab sessions snapshot (payload 为任意 JSON 值,见 PUT body schema)',
        },
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
            'tab sessions snapshot + expected version (payload 为任意 JSON 值,handler 端用 JsonValueSchema 校验)',
        ),
    },
    responses: {
        [HttpStatusCodes.OK]: {
            description: 'updated (payload 为任意 JSON 值)',
        },
        [HttpStatusCodes.CONFLICT]: {
            description: 'version mismatch (currentPayload 任意 JSON 值,nullable)',
        },
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
