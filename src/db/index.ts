import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import env from '../env.js';

import * as schema from './schema.js'

const client = postgres(env.DATABASE_URL, {
    // 本地 docker 不需要 SSL；生产托管 PG 时通常需要
    ssl: env.DATABASE_SSL === 'true' ? 'require' : false,
});
const db = drizzle(client, { schema });

export default db;
export { client };