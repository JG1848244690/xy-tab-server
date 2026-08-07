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
                url: '/doc'
            }
        })
    )
}