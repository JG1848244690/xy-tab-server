import configureOpenAPI from "./lib/configure-open-api.js"
import createApp from "./lib/create-app.js"
import index from './routes/index.route.js'
import tasks from './routes/tasks/tasks.index.js'
import auth from './modules/auth/auth.index.js'
import sync from './modules/sync/sync.index.js'
import { bearerAuth } from "./middlewares/auth.js"

const app = createApp()

// === 云同步相关路由的鉴权中间件 ===
// 公开: POST /sync/auth/google(在 auth.index.ts 里)
// 鉴权: /sync/auth/logout, /sync/auth/me, /sync/bookmarks, /sync/sessions
app.use('/sync/auth/logout', bearerAuth())
app.use('/sync/auth/me', bearerAuth())
app.use('/sync/bookmarks', bearerAuth())
app.use('/sync/sessions', bearerAuth())

const routes = [
    index,
    tasks,
    auth,
    sync,
] as const;

routes.forEach((route) => {
    app.route('/', route)
})

configureOpenAPI(app)

type AppType = typeof routes[number]

export default app
