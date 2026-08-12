/**
 * Bearer session token 中间件
 *
 * 用法:
 *   app.use('/sync/*', bearerAuth())   // 全 /sync 子树都需要登录
 *   或
 *   onRoute(routes.x, bearerAuth())    // 单个路由需要登录
 *
 * 通过后会往 c.set('userId', userId) 注入 userId
 */

import { createMiddleware } from 'hono/factory';
import { eq, and, gt } from 'drizzle-orm';
import db from '../db/index.js';
import { userSessions, users } from '../db/schema.js';
import type { AppBindings } from '../lib/types.js';

export const bearerAuth = () =>
  createMiddleware<AppBindings>(async (c, next) => {
    const auth = c.req.header('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing Bearer token' }, 401);
    }
    const token = auth.slice(7).trim();
    if (!token) {
      return c.json({ error: 'Empty token' }, 401);
    }

    // 查 session + user,顺便刷新 last_used_at
    const rows = await db
      .select({
        userId: users.id,
        email: users.email,
        expiresAt: userSessions.expiresAt,
      })
      .from(userSessions)
      .innerJoin(users, eq(users.id, userSessions.userId))
      .where(and(eq(userSessions.id, token), gt(userSessions.expiresAt, new Date())))
      .limit(1);

    const session = rows[0];
    if (!session) {
      return c.json({ error: 'Invalid or expired session' }, 401);
    }

    // 后台更新 last_used_at(不 await,不阻塞)
    void db.update(userSessions)
      .set({ lastUsedAt: new Date() })
      .where(eq(userSessions.id, token))
      .catch((e) => console.warn('[Auth] last_used_at update failed:', e));

    c.set('userId', session.userId);
    c.set('userEmail', session.email);
    await next();
  });
