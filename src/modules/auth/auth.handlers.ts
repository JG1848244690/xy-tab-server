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
// 简化模式:扩展自己用 chrome.identity.getAuthToken 拿 token,然后 fetch userinfo,
// 把 userinfo JSON 直接转发过来。后端零 Google API 调用,适合 NAT 网关/防火墙
// 屏蔽 HTTPS 出站的部署环境。trust 模型:扩展代码是开源的,用户可以审计;
// 恶意扩展理论上能伪造 userinfo,但那已经不是 auth 能防的范围了。
export const googleLogin: AppRouteHandler<GoogleLoginRoute> = async (c) => {
    const { googleSub, email, emailVerified, name, picture } = c.req.valid('json');

    if (!emailVerified) {
        return c.json({ error: 'email not verified by Google' }, HttpStatusCodes.UNAUTHORIZED);
    }

    // upsert user —— 同 email 重复登录 = 同一行(sha256(email) 作为主键)
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
