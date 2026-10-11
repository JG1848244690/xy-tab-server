import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { HttpStatusCodes, JsonValueSchema, type JsonValue } from '../../lib/openapi.js';
import db from '../../db/index.js';
import { syncBookmarks, syncTabSessions } from '../../db/schema.js';
import type {
    GetBookmarksRoute,
    PutBookmarksRoute,
    GetSessionsRoute,
    PutSessionsRoute,
} from './sync.routes.js';
import type { AppRouteHandler, AppBindings } from '../../lib/types.js';
import type { Context } from 'hono';

// ============================================================
// GET /sync/bookmarks
// row.payload 是 jsonb 列 → 类型为 unknown(从 DB 拿出来确实不知道形状)。
// route 声明的 payload 是 JsonValue(任意 JSON 值)。用显式 `as JsonValue` 收口:
//   - 运行时数据 100% 是 JSON(jsonb 列就是 JSON),
//   - 不用 z.any()(绕过类型)也不用 as never(放弃类型),
//   - cast 目标就是 route schema 的实际类型,比 unknown 更精确
// ============================================================
export const getBookmarks: AppRouteHandler<GetBookmarksRoute> = async (c) => {
    const userId = c.get('userId')!;
    const [row] = await db
        .select()
        .from(syncBookmarks)
        .where(eq(syncBookmarks.userId, userId))
        .limit(1);

    if (!row) {
        return c.json({ error: 'no snapshot yet' }, HttpStatusCodes.NOT_FOUND);
    }

    return c.json(
        {
            payload: row.payload as JsonValue,
            version: row.version,
            updatedAt: row.updatedAt.toISOString(),
        },
        HttpStatusCodes.OK,
    );
};

// ============================================================
// PUT /sync/bookmarks (乐观锁)
// expectedVersion 必须等于当前 version,否则 409
// expectedVersion = 0 表示首次写入(INSERT)
// 不用 AppRouteHandler<PutBookmarksRoute> —— @hono/zod-openapi 0.19 在
// RouteConfigToTypedResponse<R> 推导时 TS 递归爆栈(TS2589)。
// 改用更轻的 (c: Context<AppBindings>) => Promise<Response> 签名,
// body 自己用 c.req.json() + zod parse 校验(运行时类型 + zod 校验都到位)
// ============================================================
export const putBookmarks = async (c: Context<AppBindings>): Promise<Response> => {
    const userId = c.get('userId')!;
    const { payload: rawPayload, expectedVersion } = z.object({
        payload: z.unknown(),
        expectedVersion: z.number().int().nonnegative(),
    }).parse(await c.req.json());
    const payload = JsonValueSchema.parse(rawPayload);

    const [current] = await db
        .select()
        .from(syncBookmarks)
        .where(eq(syncBookmarks.userId, userId))
        .limit(1);

    if (current) {
        if (current.version !== expectedVersion) {
            return c.json(
                {
                    error: 'version mismatch',
                    currentVersion: current.version,
                    currentPayload: current.payload as JsonValue | null,
                },
                HttpStatusCodes.CONFLICT,
            );
        }

        const newVersion = current.version + 1;
        await db
            .update(syncBookmarks)
            .set({
                payload: payload as object,
                version: newVersion,
                updatedAt: new Date(),
            })
            .where(eq(syncBookmarks.userId, userId));

        return c.json(
            {
                payload,
                version: newVersion,
                updatedAt: new Date().toISOString(),
            },
            HttpStatusCodes.OK,
        );
    } else {
        if (expectedVersion !== 0) {
            return c.json(
                {
                    error: 'version mismatch (no snapshot exists, expected 0)',
                    currentVersion: 0,
                    currentPayload: null,
                },
                HttpStatusCodes.CONFLICT,
            );
        }

        await db.insert(syncBookmarks).values({
            userId,
            payload: payload as object,
            version: 1,
        });

        return c.json(
            {
                payload,
                version: 1,
                updatedAt: new Date().toISOString(),
            },
            HttpStatusCodes.OK,
        );
    }
};

// ============================================================
// GET /sync/sessions
// ============================================================
export const getSessions: AppRouteHandler<GetSessionsRoute> = async (c) => {
    const userId = c.get('userId')!;
    const [row] = await db
        .select()
        .from(syncTabSessions)
        .where(eq(syncTabSessions.userId, userId))
        .limit(1);

    if (!row) {
        return c.json({ error: 'no snapshot yet' }, HttpStatusCodes.NOT_FOUND);
    }

    return c.json(
        {
            payload: row.payload,
            version: row.version,
            updatedAt: row.updatedAt.toISOString(),
        },
        HttpStatusCodes.OK,
    );
};

// ============================================================
// PUT /sync/sessions (乐观锁)
// 同 putBookmarks —— 不用 AppRouteHandler<PutSessionsRoute>,自己 c.req.json() 校验
// ============================================================
export const putSessions = async (c: Context<AppBindings>): Promise<Response> => {
    const userId = c.get('userId')!;
    const { payload: rawPayload, expectedVersion } = z.object({
        payload: z.unknown(),
        expectedVersion: z.number().int().nonnegative(),
    }).parse(await c.req.json());
    const payload = JsonValueSchema.parse(rawPayload);

    const [current] = await db
        .select()
        .from(syncTabSessions)
        .where(eq(syncTabSessions.userId, userId))
        .limit(1);

    if (current) {
        if (current.version !== expectedVersion) {
            return c.json(
                {
                    error: 'version mismatch',
                    currentVersion: current.version,
                    currentPayload: current.payload as JsonValue | null,
                },
                HttpStatusCodes.CONFLICT,
            );
        }

        const newVersion = current.version + 1;
        await db
            .update(syncTabSessions)
            .set({
                payload: payload as object,
                version: newVersion,
                updatedAt: new Date(),
            })
            .where(eq(syncTabSessions.userId, userId));

        return c.json(
            {
                payload,
                version: newVersion,
                updatedAt: new Date().toISOString(),
            },
            HttpStatusCodes.OK,
        );
    } else {
        if (expectedVersion !== 0) {
            return c.json(
                {
                    error: 'version mismatch (no snapshot exists, expected 0)',
                    currentVersion: 0,
                    currentPayload: null,
                },
                HttpStatusCodes.CONFLICT,
            );
        }

        await db.insert(syncTabSessions).values({
            userId,
            payload: payload as object,
            version: 1,
        });

        return c.json(
            {
                payload,
                version: 1,
                updatedAt: new Date().toISOString(),
            },
            HttpStatusCodes.OK,
        );
    }
};
