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
import { verifyGoogleIdToken } from './jwt.js';

// ============================================================
// POST /sync/auth/google — 公开
// ============================================================
// 用 jose + 本地静态 JWKS(google-jwks.json,CI 每月更新)验签 id_token。
// 服务器零 HTTPS 出站(NAT 网关屏蔽 443)。验证通过后从 payload 拿 sub / email
// / name / picture,upsert users,发 sessionToken。
export const googleLogin: AppRouteHandler<GoogleLoginRoute> = async (c) => {
    const { idToken, nonce } = c.req.valid('json');

    // 验签(RS256 + issuer + audience + 签名 + 可选 nonce)
    let payload;
    try {
        payload = await verifyGoogleIdToken(idToken, nonce);
    } catch (err) {
        console.error('[Auth] id_token verify failed:', err);
        return c.json(
            { error: err instanceof Error ? err.message : 'id_token verify failed' },
            HttpStatusCodes.UNAUTHORIZED,
        );
    }

    if (!payload.email || !payload.sub) {
        return c.json(
            { error: 'id_token payload missing email or sub' },
            HttpStatusCodes.UNAUTHORIZED,
        );
    }

    // upsert user —— 同 email 重复登录 = 同一行(sha256(email) 作为主键)
    const userId = hashEmail(payload.email);
    await db
        .insert(users)
        .values({
            id: userId,
            email: payload.email,
            googleSub: payload.sub,
            name: payload.name ?? null,
            picture: payload.picture ?? null,
            lastLoginAt: new Date(),
        })
        .onConflictDoUpdate({
            target: users.id,
            set: {
                email: payload.email,
                googleSub: payload.sub,
                name: payload.name ?? null,
                picture: payload.picture ?? null,
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
            email: payload.email,
            name: payload.name ?? null,
            picture: payload.picture ?? null,
            googleSub: payload.sub,
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
