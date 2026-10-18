/**
 * middlewares.ts —— 替代 stoker/middlewares
 *
 * 提供三个最常用的 Hono 中间件/handler:
 *   - serveEmojiFavicon(emoji):在 GET /favicon.ico 时返 emoji 文本
 *   - notFound:404 兜底
 *   - onError:错误统一处理
 *
 * 行为跟 stoker 一致,直接 inline 过来不依赖 stoker。
 */
import { HTTPException } from 'hono/http-exception';
import { AppError, errorBody } from './errors.js';
export const serveEmojiFavicon = (emoji) => async (c, next) => {
    if (c.req.path === '/favicon.ico') {
        return c.body(emoji);
    }
    await next();
};
export const notFound = (c) => c.json(errorBody('Not Found', 'NOT_FOUND'), 404);
/**
 * onError —— 全局兜底错误处理(B13)
 *
 * 之前:`console.error` + 把 err.message 原样返回。数据库驱动错误的 message
 * 会带表名/列名/SQL 片段,直接泄露;且绕过 pino,日志无 requestId 无法反查。
 *
 * 现在:
 *   - AppError(业务预期失败)→ 按携带的 status/code 返回,warn 级日志;
 *   - HTTPException(hono/zod-openapi 主动抛出)→ 同样透传 status;
 *   - 未知错误 → 响应只有 'Internal Server Error' + requestId,细节全进日志。
 */
export const onError = (err, c) => {
    // hono-pino 的 http.reqId 会把 requestId 放进 context;拿不到就现生成一个
    const requestId = c.get('requestId') ?? crypto.randomUUID();
    const logger = c.get('logger');
    if (err instanceof AppError) {
        logger?.warn({ err, requestId }, 'app error');
        return c.json(errorBody(err.message, err.code, requestId), err.status);
    }
    if (err instanceof HTTPException) {
        const body = errorBody(err.message || 'Request failed', 'HTTP_ERROR', requestId);
        if (err.status >= 500) {
            logger?.error({ err, requestId }, 'http exception');
        }
        else {
            logger?.warn({ err, requestId }, 'http exception');
        }
        return c.json(body, err.status);
    }
    // 未知错误:绝不把 err.message 透给客户端
    logger?.error({ err, requestId }, 'unhandled error');
    return c.json(errorBody('Internal Server Error', 'INTERNAL_SERVER_ERROR', requestId), 500);
};
