import { eq } from 'drizzle-orm';
import db from '../../db/index.js';
import { users } from '../../db/schema.js';
import { HttpStatusCodes } from '../../lib/openapi.js';
import { errorBody } from '../../lib/errors.js';
import env from '../../env.js';
import { clearAuthCookie, hashPassword, setAuthCookie, signToken, verifyPassword, } from '../../lib/auth.js';
/**
 * 邮箱不存在时也执行一次同成本的 bcrypt compare,抹平两种失败路径的耗时差,
 * 防止通过响应时间探测"这个邮箱有没有注册过"。
 * 模块加载时算一次 dummy hash,后续只做 compare。
 */
const DUMMY_HASH_PROMISE = hashPassword('timing-equalization-dummy');
/** users 行 -> 前端期望的形状(username 映射成 name) */
function toUserResponse(row) {
    // selectUserSchema 是 omit 掉 password 的,不 parse 全行,否则 zod 会因
    // 多出的 password 键报错;这里手动挑字段
    return {
        id: row.id,
        email: row.email,
        username: row.username,
        avatarPath: row.avatarPath,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        name: row.username,
    };
}
export const login = async (c) => {
    const { email, password } = c.req.valid('json');
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    // 邮箱不存在和密码错误返回同一个 401、走同样耗时的 bcrypt compare,不泄露账号是否存在
    if (user) {
        if (!(await verifyPassword(password, user.password))) {
            return c.json({ message: 'Invalid credentials' }, HttpStatusCodes.UNAUTHORIZED);
        }
    }
    else {
        await verifyPassword(password, await DUMMY_HASH_PROMISE);
        return c.json({ message: 'Invalid credentials' }, HttpStatusCodes.UNAUTHORIZED);
    }
    const token = await signToken(user.id, user.email);
    setAuthCookie(c, token);
    return c.json({ user: toUserResponse(user) }, HttpStatusCodes.OK);
};
export const register = async (c) => {
    // 注册开关:封口时服务器 .env 里 REGISTRATION_ENABLED=false 重启即可
    if (env.REGISTRATION_ENABLED === 'false') {
        return c.json({ message: 'Registration is disabled' }, HttpStatusCodes.FORBIDDEN);
    }
    const { email, password, name } = c.req.valid('json');
    // 不再做先查后插:并发注册同一邮箱时两边都能过查重,后到者撞唯一索引
    // 变 500(还把 PG 错误信息泄露给客户端)。onConflictDoNothing 让数据库
    // 一锤定音,returning 为空即冲突 → 409
    const [created] = await db
        .insert(users)
        .values({ email, password: await hashPassword(password), username: name })
        .onConflictDoNothing({ target: users.email })
        .returning();
    if (!created) {
        return c.json(errorBody('User already exists', 'CONFLICT'), HttpStatusCodes.CONFLICT);
    }
    // 旧 Nest 的 register 不下发登录态,前端注册后仍需走一次 login,保持一致
    return c.json(toUserResponse(created), HttpStatusCodes.OK);
};
export const logout = (c) => {
    clearAuthCookie(c);
    return c.json({ message: 'Logged out successfully' }, HttpStatusCodes.OK);
};
/** userId 由 app.ts 里挂的 cookieAuth 中间件注入,没走到这里的都是已登录 */
export const me = async (c) => {
    const userId = c.get('userId');
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    // 中间件已确认用户存在,这里仍兜一层,避免删号瞬间返 500
    if (!user) {
        return c.json({ message: 'User not found' }, HttpStatusCodes.UNAUTHORIZED);
    }
    return c.json(toUserResponse(user), HttpStatusCodes.OK);
};
