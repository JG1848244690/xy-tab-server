/**
 * 集成测试公共设施(真 PG,经 app.request 全链路打进来)
 *
 * 和 auth.test.ts 的 mock-db 单测互补:mock 单测测契约形状,
 * 这里测真实 SQL 行为 —— 可见性隔离、事务一致性、唯一索引兜底,
 * 这些恰恰是 mock 测不出来、又最容易出事故的部分(B21)。
 *
 * 运行条件:TEST_DATABASE_URL(见 vitest.setup.ts)。没配则整个跳过,
 * `pnpm test --run` 在任何环境都能跑。
 */
import { sql } from 'drizzle-orm';
import { signToken } from '../lib/auth.js';
import env from '../env.js';
/** 用 signToken 直接造登录态,不走 /auth/login(省 bcrypt 耗时,也避开限流桶) */
export function req(app, user, path, init = {}) {
    return signToken(user.id, user.email).then((token) => app.request(path, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            Cookie: `${env.AUTH_COOKIE_NAME}=${token}`,
            ...(init.headers ?? {}),
        },
    }));
}
/** 清空业务表(用户保留):question_stats / question_attempts 随 questions 级联清掉 */
export async function truncateBusinessTables(db) {
    await db.execute(sql `truncate table questions, todos restart identity cascade`);
}
