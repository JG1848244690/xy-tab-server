/**
 * errors.ts —— 业务错误统一出口(B3/B13)
 *
 * 以前的问题:401/404 至少 4 种响应形状({error}/{message}),onError 把
 * err.message 原样返回给客户端(会泄露 PG 的表名/列名/SQL 片段)。
 *
 * 统一约定:
 *   - 业务代码 throw errors.notFound('xxx') 之类,由 app.onError 统一转响应;
 *   - 错误响应体一律 { message, code, requestId? },message 保持顶层 ——
 *     前端 axios 拦截器和各表单读的是 err.response.data.message,不能破坏;
 *   - 未知错误的细节只进日志,响应里只有 'Internal Server Error' + requestId。
 */
/** 业务预期内的失败(参数错/不存在/无权/冲突),status 和 message 都可信 */
export class AppError extends Error {
    // hono 的 c.json 第二参要状态码字面量类型,直接用它的,
    // 省得调用处到处 as 强转
    status;
    code;
    constructor(message, status, code) {
        super(message);
        this.name = 'AppError';
        this.status = status;
        this.code = code;
    }
}
/** 常用错误的工厂,避免到处 new AppError 记状态码 */
export const errors = {
    badRequest: (message = 'Bad Request') => new AppError(message, 400, 'BAD_REQUEST'),
    unauthorized: (message = 'Unauthorized') => new AppError(message, 401, 'UNAUTHORIZED'),
    forbidden: (message = 'Forbidden') => new AppError(message, 403, 'FORBIDDEN'),
    notFound: (message = 'Not Found') => new AppError(message, 404, 'NOT_FOUND'),
    conflict: (message = 'Conflict') => new AppError(message, 409, 'CONFLICT'),
};
/** 统一错误响应体。requestId 有才带,方便用户报障时反查日志 */
export const errorBody = (message, code, requestId) => requestId ? { message, code, requestId } : { message, code };
