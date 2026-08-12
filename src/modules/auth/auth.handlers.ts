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
    exchangeCodeForTokens,
    fetchUserInfo,
    isAllowedRedirect,
} from './google-token.js';
import {
    generateSessionToken,
    hashEmail,
    expiresAtFromNow,
} from './session.js';

// ============================================================
// POST /sync/auth/google — 公开
// ============================================================
export const googleLogin: AppRouteHandler<GoogleLoginRoute> = async (c) => {
    const { code, redirectUri } = c.req.valid('json');

    if (!isAllowedRedirect(redirectUri)) {
        return c.json({ error: 'redirect_uri not allowed' }, HttpStatusCodes.BAD_REQUEST);
    }

    // 1. 用 code 换 token
    let tokens;
    try {
        tokens = await exchangeCodeForTokens(code, redirectUri);
    } catch (err) {
        console.error('[Auth] token exchange failed:', err);
        return c.json(
            { error: err instanceof Error ? err.message : 'token exchange failed' },
            HttpStatusCodes.UNAUTHORIZED,
        );
    }

    // 2. 用 access_token 拿 userinfo
    let info;
    try {
        info = await fetchUserInfo(tokens.access_token);
    } catch (err) {
        console.error('[Auth] userinfo failed:', err);
        return c.json(
            { error: err instanceof Error ? err.message : 'userinfo failed' },
            HttpStatusCodes.UNAUTHORIZED,
        );
    }

    if (!info.email_verified) {
        return c.json({ error: 'Google email not verified' }, HttpStatusCodes.UNAUTHORIZED);
    }

    // 3. upsert user
    const userId = hashEmail(info.email);
    await db
        .insert(users)
        .values({
            id: userId,
            email: info.email,
            googleSub: info.sub,
            name: info.name ?? null,
            picture: info.picture ?? null,
            lastLoginAt: new Date(),
        })
        .onConflictDoUpdate({
            target: users.id,
            set: {
                email: info.email,
                googleSub: info.sub,
                name: info.name ?? null,
                picture: info.picture ?? null,
                lastLoginAt: new Date(),
                updatedAt: new Date(),
            },
        });

    // 4. 颁发 session token
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
            email: info.email,
            name: info.name ?? null,
            picture: info.picture ?? null,
            googleSub: info.sub,
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
