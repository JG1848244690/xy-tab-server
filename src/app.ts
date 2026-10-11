import configureOpenAPI from './lib/configure-open-api.js'
import createApp from './lib/create-app.js'
import index from './routes/index.route.js'
import auth from './routes/auth/auth.index.js'
import questions from './routes/questions/questions.index.js'
import todos from './routes/todos/todos.index.js'
import stats from './routes/stats/stats.index.js'
import { cookieAuth } from './middlewares/auth.js'

const app = createApp()

/**
 * 鉴权中间件按路径应用
 *
 * 公开: POST /auth/login, POST /auth/register, POST /auth/logout
 * 鉴权: /auth/me 及 questions / todos / stats 全部子树
 *
 * 服务路径不带 /api 前缀 —— 前端 Next 的 rewrite 会把 /api/x 剥成 /x 再打到这,
 * 服务器上的 nginx 也用同样的规则剥 /api。
 */
app.use('/auth/me', cookieAuth())
app.use('/questions', cookieAuth())
app.use('/questions/*', cookieAuth())
app.use('/todos', cookieAuth())
app.use('/todos/*', cookieAuth())
app.use('/stats', cookieAuth())
app.use('/stats/*', cookieAuth())

const routes = [
    index,
    auth,
    questions,
    todos,
    stats,
] as const

routes.forEach((route) => {
    app.route('/', route)
})

configureOpenAPI(app)

type AppType = typeof routes[number]

export default app