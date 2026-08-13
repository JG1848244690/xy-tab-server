import type { AppOpenAPI } from "./types.js";
import packageJson from '../../package.json' with { type: 'json' }
import { apiReference } from "@scalar/hono-api-reference";
import env from '../env.js'

export default function configureOpenAPI(app: AppOpenAPI) {
    // 生产挂在 nginx /api 反代后:OPENAPI_BASE_PATH='/api'
    //   → spec 写 servers,Scalar 的 curl / Try it out 自动拼成 /api/tasks
    // 本机直连:OPENAPI_BASE_PATH='' → 不写 servers,默认用 doc host
    const servers = env.OPENAPI_BASE_PATH
        ? [{ url: env.OPENAPI_BASE_PATH }]
        : undefined

    app.doc('/doc', {
        openapi: '3.0.0',
        info: {
            version: packageJson.version,
            title: 'Tasks API'
        },
        ...(servers ? { servers } : {})
    })

    // 注册 Bearer 鉴权方案到 spec 的 components.securitySchemes
    // 让 Scalar / Swagger 在带 `security: [{ Bearer: [] }]` 的路由弹输入框
    // (OpenAPIObjectConfig 类型 Omit 了 components,必须走 registry)
    app.openAPIRegistry.registerComponent('securitySchemes', 'Bearer', {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'opaque',  // 我们是 DB 存的随机 UUID,不是 JWT
    })
    app.get(
        '/reference',
        apiReference({
            defaultHttpClient: {
                targetKey: 'javascript',
                clientKey: 'fetch'
            },
            spec: {
                // Scalar 拉 spec 的地址同样要带前缀;空串时退化为 /doc
                url: `${env.OPENAPI_BASE_PATH}/doc`
            }
        })
    )
}