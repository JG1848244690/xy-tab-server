import type { AppOpenAPI } from "./types.js";
import packageJson from '../../package.json' with { type: 'json' }
import { apiReference } from "@scalar/hono-api-reference";
export default function configureOpenAPI(app: AppOpenAPI) {
    app.doc('/doc', {
        openapi: '3.0.0',
        info: {
            version: packageJson.version,
            title: 'Tasks API'
        }
    })
    app.get(
        '/reference',
        apiReference({
            defaultHttpClient: {
                targetKey: 'javascript',
                clientKey: 'fetch'
            },
            spec: {
                // 走 nginx /api/ 反代后,Scalar 的 spec URL 必须带 /api 前缀
                // 否则浏览器会拉 kskbl.com.cn/doc(没 /api),nginx 无对应 location
                url: '/api/doc'
            }
        })
    )
}