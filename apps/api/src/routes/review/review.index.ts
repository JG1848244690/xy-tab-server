import { createRouter } from '../../lib/create-app.js'
import * as handlers from './review.handlers.js'
import * as routes from './review.routes.js'

// cookieAuth 中间件在 src/app.ts 按路径应用(/review 与 /review/*)

const router = createRouter()
    .openapi(routes.triggerOne, handlers.triggerOne)
    .openapi(routes.triggerBatch, handlers.triggerBatch)
    .openapi(routes.result, handlers.result)
    .openapi(routes.stale, handlers.stale)
    .openapi(routes.queue, handlers.queue)
    .openapi(routes.humanDecision, handlers.humanDecision)

export default router
