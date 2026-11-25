import { logger } from 'hono-pino'
import pino from 'pino';
import pretty from 'pino-pretty'
import env from '../env.js'
export function pinoLogger() {
    return logger({
        pino: pino(
            {
                level: env.LOG_LEVEL || 'info'
            },
            env.NODE_ENV === 'production' ? undefined : pretty()),
        http: {
            onReqBindings: (c) => ({ req: { url: c.req.path, method: c.req.method } }),
            onResBindings: (c) => ({ res: { status: c.res.status } }),
        }
    });
}
