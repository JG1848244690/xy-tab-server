import { OpenAPIHono } from '@hono/zod-openapi';
import { prettyJSON } from 'hono/pretty-json';
import { cors } from 'hono/cors';
import { pinoLogger } from '../middlewares/pino-logger.js';
import env from '../env.js';
import { notFound, onError, serveEmojiFavicon } from './middlewares.js';
import { defaultHook } from './openapi.js';
export function createRouter() {
    return new OpenAPIHono({
        strict: false,
        defaultHook
    });
}
export default function createApp() {
    const app = createRouter();
    app.use(serveEmojiFavicon("🔥"));
    app.use(pinoLogger());
    app.use(prettyJSON());
    // 同源 SPA 已不需要跨域;留 CORS 只为兼容开发期前端 dev server。
    // CORS_ORIGINS 非空时收紧为白名单(生产),为空时维持原全放行(本地)
    const allowlist = env.CORS_ORIGINS.split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    app.use(cors(allowlist.length ? { origin: allowlist } : {}));
    app.notFound(notFound);
    app.onError(onError);
    return app;
}
export function createTestApp(router) {
    const testApp = createApp();
    testApp.route("/", router);
    return testApp;
}
