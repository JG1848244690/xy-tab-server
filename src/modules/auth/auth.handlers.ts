import { eq } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import db from '../../db/index.js';
import { users, userSessions } from '../../db/schema.js';
import type {
    GoogleLoginRoute,
    LogoutRoute,
    MeRoute,
} from './auth.routes.js';
import type { AppRouteHandler } from '../../lib/types.js';
import {
    generateSessionToken,
    hashEmail,
    expiresAtFromNow,
} from './session.js';

// ============================================================
// POST /sync/auth/google — 公开
// ============================================================
// 极简模式:扩展用 launchWebAuthFlow 拿到 id_token,解码 payload 拿 email,
// 只把 email POST 过来。后端不调 Google、不验签,用 email 派生 userId,
// upsert users,发 sessionToken。
//
// ⚠️ 安全警告:任何能 POST 到本端点的人只要知道 email 就能拿到对应用户
// 的 sessionToken,进而读写 sync_bookmarks / sync_tab_sessions。只适合
// 个人/小范围使用,生产前必须加防护(apiKey / 签名验证 / IP 白名单 等)。
export const googleLogin: AppRouteHandler<GoogleLoginRoute> = async (c) => {
    const { email, name, picture } = c.req.valid('json');

    // googleSub 字段 schema 仍然要求非空,这里用 email 当占位(简化模式下
    // 不真正从 Google 拿 sub,后续如果升级到验签方案可以补回真 sub)
    const googleSub = email;

    const userId = hashEmail(email);
    await db
        .insert(users)
        .values({
            id: userId,
            email,
            googleSub,
            name: name ?? null,
            picture: picture ?? null,
            lastLoginAt: new Date(),
        })
        .onConflictDoUpdate({
            target: users.id,
            set: {
                email,
                googleSub,
                name: name ?? null,
                picture: picture ?? null,
                lastLoginAt: new Date(),
                updatedAt: new Date(),
            },
        });

    // 颁发 session token
    const sessionToken = generateSessionToken();
    await db.insert(userSessions).values({
        id: sessionToken,
        userId,
        expiresAt: expiresAtFromNow(),
        userAgent: c.req.header('User-Agent')?.slice(0, 200) ?? null,
    });

    return c.json({
        sessionToken,
        user: {
            id: userId,
            email,
            name: name ?? null,
            picture: picture ?? null,
            googleSub,
        },
    }, HttpStatusCodes.OK);
};

// ============================================================
// POST /sync/auth/logout — Bearer(由 router.use() 加中间件)
// ============================================================
export const logout: AppRouteHandler<LogoutRoute> = async (c) => {
    const auth = c.req.header('Authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;
    if (token) {
        await db.delete(userSessions).where(eq(userSessions.id, token));
    }
    return c.json({ success: true }, HttpStatusCodes.OK);
};

// ============================================================
// GET /sync/auth/me — Bearer(由 router.use() 加中间件)
// ============================================================
export const me: AppRouteHandler<MeRoute> = async (c) => {
    const userId = c.get('userId');
    if (!userId) {
        return c.json({ error: 'unauthorized' }, HttpStatusCodes.UNAUTHORIZED);
    }

    const [row] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!row) {
        return c.json({ error: 'user not found' }, HttpStatusCodes.UNAUTHORIZED);
    }

    return c.json({
        id: row.id,
        email: row.email,
        name: row.name,
        picture: row.picture,
        googleSub: row.googleSub,
    }, HttpStatusCodes.OK);
};
