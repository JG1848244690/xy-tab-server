import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import env from '../env.js';

import * as schema from './schema.js'

const client = postgres(env.DATABASE_URL, {
    // 本地 docker 不需要 SSL；生产托管 PG 时通常需要
    ssl: env.DATABASE_SSL === 'true' ? 'require' : false,
    // 连接池显式配置(B11):postgres.js 默认 max=10 且没有任何超时,
    // 慢查询/连接悬挂会占满池子拖垮整个服务,这里给每个环节都兜底
    max: 10,
    idle_timeout: 30, // 秒:空闲连接 30s 回收,避免长期挂死
    connect_timeout: 10, // 秒:建连超时,PG 不可达时快速失败
    max_lifetime: 60 * 30, // 秒:连接最长 30min 轮换,防泄漏/防防火墙掐长连接
});
const db = drizzle(client, { schema });

export default db;
export { client };