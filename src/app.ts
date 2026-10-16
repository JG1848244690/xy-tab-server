import configureOpenAPI from './lib/configure-open-api.js'
import createApp from './lib/create-app.js'
import index from './routes/index.route.js'
import auth from './routes/auth/auth.index.js'
import questions from './routes/questions/questions.index.js'
import todos from './routes/todos/todos.index.js'
import stats from './routes/stats/stats.index.js'
import { cookieAuth } from './middlewares/auth.js'
import { rateLimit } from './middlewares/rate-limit.js'

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
// 登录/注册是唯一对全网裸奔的写入口,先过限流再进 handler
// (固定窗口 30 req/min/IP;nginx 反代会带 x-forwarded-for)
app.use('/auth/login', rateLimit({ windowMs: 60_000, max: 30 }))
app.use('/auth/register', rateLimit({ windowMs: 60_000, max: 30 }))
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