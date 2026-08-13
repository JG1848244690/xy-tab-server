import configureOpenAPI from "./lib/configure-open-api.js"
import createApp from "./lib/create-app.js"
import index from './routes/index.route.js'
import tasks from './routes/tasks/tasks.index.js'
import auth from './modules/auth/auth.index.js'
import sync from './modules/sync/sync.index.js'
import agent from './modules/agent/agent.index.js'
import { bearerAuth } from "./middlewares/auth.js"

const app = createApp()

// === 云同步相关路由的鉴权中间件 ===
// 公开: POST /sync/auth/google(在 auth.index.ts 里)
// 鉴权: /sync/auth/logout, /sync/auth/me, /sync/bookmarks, /sync/sessions, /sync/agent/chat
app.use('/sync/auth/logout', bearerAuth())
app.use('/sync/auth/me', bearerAuth())
app.use('/sync/bookmarks', bearerAuth())
app.use('/sync/sessions', bearerAuth())
// TODO(feat/deepagent): 测完流式记得加回来 —— /sync/agent/chat 是会消耗 token 的端点,生产必须鉴权
// app.use('/sync/agent/chat', bearerAuth())

const routes = [
    index,
    tasks,
    auth,
    sync,
    agent,
] as const;

routes.forEach((route) => {
    app.route('/', route)
})

configureOpenAPI(app)

type AppType = typeof routes[number]

export default app
