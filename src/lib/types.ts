import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi"
import type { PinoLogger } from "hono-pino"

export interface AppBindings {
    Variables: {
        logger: PinoLogger
        // 由 src/middlewares/auth.ts 注入
        userId?: string
        userEmail?: string
    }
}

export type AppOpenAPI = OpenAPIHono<AppBindings>

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>
