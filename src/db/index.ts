import 'dotenv/config';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import env from '../env.js';

import * as schema from './schema.js'
const client = createClient({
    url: env.DATABASE_URL!,
    authToken: env.DATABASE_AUTH_TOKEN!
});
const db = drizzle(client, {
    schema
});

export default db;
