import { createRouter } from '../../lib/create-app.js'
import * as handlers from './media.handlers.js'
import * as routes from './media.routes.js'

// cookieAuth 在 src/app.ts 按路径应用(/media 与 /media/*)
// 文件本身的 GET /uploads/* 在 app.ts 里直接托管(免登录,图片是公开资源)

const router = createRouter()
    .openapi(routes.upload, handlers.upload)
    .openapi(routes.list, handlers.list)
    .openapi(routes.remove, handlers.remove)
    .openapi(routes.cleanup, handlers.cleanup)

export default router
