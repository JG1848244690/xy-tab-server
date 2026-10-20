import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi"
import type { PinoLogger } from "hono-pino"

export interface AppBindings {
    Bindings: Record<string, never>
    Variables: {
        // hono-pino 中间件运行时注入;中间件之前的阶段不存在,所以可空
        logger?: PinoLogger
        // hono-pino 的 http.reqId 注入的请求 id,onError 里用于日志串联与响应回传
        requestId?: string
        // 由 src/middlewares/auth.ts 注入
        userId?: string
        userEmail?: string
        // 由 src/middlewares/auth.ts 注入(users.role):admin 才能进审核工作台
        userRole?: 'user' | 'admin'
    }
}

export type AppOpenAPI = OpenAPIHono<AppBindings>

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>
