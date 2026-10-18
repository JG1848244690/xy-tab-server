/**
 * openapi.ts —— 替代 stoker 的 OpenAPI 辅助层
 *
 * 提供:
 *   - HttpStatusCodes / HttpStatusPhrases(替代 stoker/http-status-codes & /http-status-phrases)
 *   - jsonContent / jsonContentRequired / jsonContentOneOf(替代 stoker/openapi/helpers)
 *   - createMessageObjectSchema / createErrorSchema / IdParamsSchema(替代 stoker/openapi/schemas)
 *   - defaultHook(替代 stoker/openapi 的 zod 校验失败钩子)
 *
 * 设计目标:API 形状跟 stoker 兼容,改 import 路径即可,业务代码不动。
 */
import { z } from 'zod';
// ============================================================
// HTTP 状态码常量 —— 替代 stoker/http-status-codes
// 用 `as const` 让数字保持字面量类型,createRoute responses key 需要
// ============================================================
export const HttpStatusCodes = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
};
// ============================================================
// HTTP 状态短语 —— 替代 stoker/http-status-phrases
// 给错误响应体里 message 字段用
// ============================================================
export const HttpStatusPhrases = {
    OK: 'OK',
    CREATED: 'Created',
    NO_CONTENT: 'No Content',
    BAD_REQUEST: 'Bad Request',
    UNAUTHORIZED: 'Unauthorized',
    FORBIDDEN: 'Forbidden',
    NOT_FOUND: 'Not Found',
    CONFLICT: 'Conflict',
    UNPROCESSABLE_ENTITY: 'Unprocessable Entity',
    TOO_MANY_REQUESTS: 'Too Many Requests',
    INTERNAL_SERVER_ERROR: 'Internal Server Error',
    SERVICE_UNAVAILABLE: 'Service Unavailable',
};
// ============================================================
// Response 内容助手 —— 替代 stoker/openapi/helpers
// ============================================================
/** application/json 响应体(非必填) */
export function jsonContent(schema, description) {
    return {
        content: {
            'application/json': { schema },
        },
        description,
    };
}
/** application/json 请求/响应体(必填) */
export function jsonContentRequired(schema, description) {
    return {
        required: true,
        content: {
            'application/json': { schema },
        },
        description,
    };
}
/** application/json 联合 schema 响应(用 z.union 简化 stoker 的 oneOf) */
export function jsonContentOneOf(schemas, description) {
    return {
        content: {
            'application/json': { schema: z.union(schemas) },
        },
        description,
    };
}
// ============================================================
// 通用 schema —— 替代 stoker/openapi/schemas
// ============================================================
/** 简单 `{message: string}` schema;message 作为字面量保留语义 */
export const createMessageObjectSchema = (message) => z.object({ message: z.string().default(message) });
/** Zod 校验失败时返回的错误 schema,跟 defaultHook 的输出对齐 */
export const createErrorSchema = (_schema) => z.object({
    success: z.literal(false),
    // 顶层 message:前端表单统一读 err.response.data.message 展示
    message: z.string(),
    error: z.object({
        issues: z.array(z.object({
            code: z.string(),
            path: z.array(z.union([z.string(), z.number()])),
            message: z.string().optional(),
        })),
        name: z.literal('ZodError'),
    }),
});
/** 通用 `{id: number}` 路径参数 schema(z.coerce 自动把 URL string 转 number) */
export const IdParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});
export const JsonValueSchema = z.lazy(() => z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
]));
// ============================================================
// defaultHook —— zod 校验失败时统一返 422 JSON
// 替代 stoker/openapi 的 defaultHook
// ============================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const defaultHook = (result, c) => {
    if (!result.success) {
        return c.json({
            success: false,
            // 顶层 message:前端表单统一读 err.response.data.message 展示
            message: HttpStatusPhrases.UNPROCESSABLE_ENTITY,
            error: {
                issues: result.error.issues,
                name: 'ZodError',
            },
        }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
    }
};
