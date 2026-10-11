import { createRouter } from '../../lib/create-app.js'
import * as handlers from './stats.handlers.js'
import * as routes from './stats.routes.js'

// cookieAuth 中间件在 src/app.ts 按路径应用(/stats 与 /stats/*)

const router = createRouter()
    .openapi(routes.dashboard, handlers.dashboard)
    .openapi(routes.practiceTrend, handlers.practiceTrend)
    .openapi(routes.tagDistribution, handlers.tagDistribution)
    .openapi(routes.difficultyDistribution, handlers.difficultyDistribution)
    .openapi(routes.incompleteQuestions, handlers.incompleteQuestions)
    .openapi(routes.recentAddedQuestions, handlers.recentAddedQuestions)
    .openapi(routes.recentCompletedQuestions, handlers.recentCompletedQuestions)

export default router