import { createRouter } from '../../lib/create-app.js'
import * as handlers from './articles.handlers.js'
import * as routes from './articles.routes.js'

// cookieAuth + requireAdmin 在 src/app.ts 按路径应用
const router = createRouter()
    .openapi(routes.listArticles, handlers.list)
    .openapi(routes.createArticle, handlers.create)
    .openapi(routes.updateArticle, handlers.update)
    .openapi(routes.removeArticle, handlers.remove)

export default router
