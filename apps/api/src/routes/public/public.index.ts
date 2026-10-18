import { createRouter } from '../../lib/create-app.js'
import * as handlers from './public.handlers.js'
import * as routes from './public.routes.js'

// 免登录读接口(公开站数据源);nginx 侧另有 limit_req(见 plan §4.3)

const router = createRouter()
    .openapi(routes.listQuestions, handlers.listQuestions)
    .openapi(routes.getQuestion, handlers.getQuestion)
    .openapi(routes.viewQuestion, handlers.viewQuestion)
    .openapi(routes.listBanks, handlers.listBanks)
    .openapi(routes.getBank, handlers.getBank)
    .openapi(routes.listTags, handlers.listTags)
    .openapi(routes.listArticles, handlers.listArticles)
    .openapi(routes.getArticle, handlers.getArticle)
    .openapi(routes.sitemapData, handlers.sitemapData)

export default router
