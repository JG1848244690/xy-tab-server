import { OpenAPIHono } from '@hono/zod-openapi'
import { prettyJSON } from 'hono/pretty-json'
import { cors } from 'hono/cors'

import { pinoLogger } from '../middlewares/pino-logger.js'

import type { AppBindings, AppOpenAPI } from './types.js'

import { notFound, onError, serveEmojiFavicon } from 'stoker/middlewares'
import { defaultHook } from 'stoker/openapi'

export function createRouter() {
    return new OpenAPIHono<AppBindings>({
        strict: false,
        defaultHook
    })
}

export default function createApp() {
    const app = createRouter()

    app.use(serveEmojiFavicon("🔥"))

    app.use(pinoLogger())
    app.use(prettyJSON())
    app.use(cors())

    app.notFound(notFound)
    app.onError(onError)

    return app
}

export function createTestApp(router: AppOpenAPI) {
    const testApp = createApp()
    testApp.route("/", router)
    return testApp
}

