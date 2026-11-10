import { createRouter } from '../../lib/create-app.js'
import * as handlers from './collections.handlers.js'
import * as routes from './collections.routes.js'

// cookieAuth + requireAdmin 在 src/app.ts 按路径挂载
const router = createRouter()
    .openapi(routes.listCollections, handlers.list)
    .openapi(routes.getCollection, handlers.get)
    .openapi(routes.createCollection, handlers.create)
    .openapi(routes.updateCollection, handlers.update)
    .openapi(routes.removeCollection, handlers.remove)
    .openapi(routes.setCollectionArticles, handlers.setArticles)

export default router
