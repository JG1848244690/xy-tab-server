import { createRouter } from '../../lib/create-app.js'
import * as handlers from './stats.handlers.js'
import * as routes from './stats.routes.js'
import * as learningHandlers from './learning.handlers.js'
import * as learningRoutes from './learning.routes.js'

// cookieAuth 中间件在 src/app.ts 按路径应用(/stats 与 /stats/*)

const router = createRouter()
    .openapi(learningRoutes.learning, learningHandlers.learning)
    .openapi(learningRoutes.learningPreference, learningHandlers.learningPreference)
    .openapi(routes.dashboard, handlers.dashboard)
    .openapi(routes.practiceTrend, handlers.practiceTrend)
    .openapi(routes.tagDistribution, handlers.tagDistribution)
    .openapi(routes.difficultyDistribution, handlers.difficultyDistribution)
    .openapi(routes.incompleteQuestions, handlers.incompleteQuestions)
    .openapi(routes.recentAddedQuestions, handlers.recentAddedQuestions)
    .openapi(routes.recentCompletedQuestions, handlers.recentCompletedQuestions)

export default router
