import { eq } from 'drizzle-orm';
import { HttpStatusCodes } from '../../lib/openapi.js';
import db from '../../db/index.js';
import { syncBookmarks, syncTabSessions } from '../../db/schema.js';
import type {
    GetBookmarksRoute,
    PutBookmarksRoute,
    GetSessionsRoute,
    PutSessionsRoute,
} from './sync.routes.js';
import type { AppRouteHandler } from '../../lib/types.js';

// ============================================================
// GET /sync/bookmarks
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
            payload: row.payload,
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
// ============================================================
export const putBookmarks: AppRouteHandler<PutBookmarksRoute> = async (c) => {
    const userId = c.get('userId')!;
    const { payload, expectedVersion } = c.req.valid('json');

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
                    currentPayload: current.payload,
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
// ============================================================
export const putSessions: AppRouteHandler<PutSessionsRoute> = async (c) => {
    const userId = c.get('userId')!;
    const { payload, expectedVersion } = c.req.valid('json');

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
                    currentPayload: current.payload,
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
